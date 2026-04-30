export type ProxyChatRequestBody = {
    model: string;
    fallbackModels?: string[];
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    siteUrl?: string;
    siteName?: string;
};

export type ProxyChatHandlerOptions = {
    /**
     * Provider API key (server-only).
     *
     * If omitted, the handler will try to read from server environment:
     * - `process.env.OPENROUTER_API_KEY` (Node runtime)
     */
    apiKey?: string;
    /**
     * Optional allowlist for browser origins. When provided, requests with an
     * `Origin` not in the list will be rejected (403).
     */
    allowedOrigins?: string[];
    /**
     * Override OpenRouter endpoint. Rarely needed.
     */
    endpoint?: string;
    /**
     * Optional max request bytes guard (default ~64KB).
     */
    maxBodyBytes?: number;
};

const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

function jsonResponse(
    data: unknown,
    init?: Omit<ResponseInit, "headers"> & { headers?: HeadersInit }
): Response {
    return new Response(JSON.stringify(data), {
        ...init,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...(init?.headers ?? {})
        }
    });
}

function textResponse(
    text: string,
    init?: Omit<ResponseInit, "headers"> & { headers?: HeadersInit }
): Response {
    return new Response(text, {
        ...init,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            ...(init?.headers ?? {})
        }
    });
}

async function readJsonBodyLimited(
    request: Request,
    maxBytes: number
): Promise<unknown> {
    const len = request.headers.get("content-length");
    if (len && Number.isFinite(Number(len)) && Number(len) > maxBytes) {
        throw new Error("Request body too large.");
    }
    // Fallback: read the body and guard size ourselves.
    const raw = await request.text();
    if (raw.length > maxBytes) throw new Error("Request body too large.");
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        throw new Error("Invalid JSON body.");
    }
}

function pickReply(data: any): string | null {
    const reply =
        (typeof data?.reply === "string" && data.reply) ||
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.choices?.[0]?.message?.content === "string" &&
            data.choices[0].message.content);
    return typeof reply === "string" ? reply.trim() : null;
}

/**
 * Web-standard proxy handler for `/api/chat` (Next.js App Router, Remix, Workers, etc).
 *
 * - Accepts POST JSON: `{ model, messages, fallbackModels?, siteUrl?, siteName? }`
 * - Calls OpenRouter server-side using a server-only key
 * - Returns JSON: `{ reply: string }`
 */
export async function handleChatProxyRequest(
    request: Request,
    options: ProxyChatHandlerOptions = {}
): Promise<Response> {
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400"
            }
        });
    }

    if (request.method !== "POST") {
        return textResponse("Method Not Allowed", { status: 405 });
    }

    const origin = request.headers.get("origin");
    if (origin && options.allowedOrigins && options.allowedOrigins.length > 0) {
        if (!options.allowedOrigins.includes(origin)) {
            return textResponse("Forbidden", { status: 403 });
        }
    }

    const envKey =
        typeof (globalThis as any)?.process?.env?.OPENROUTER_API_KEY === "string"
            ? (globalThis as any).process.env.OPENROUTER_API_KEY
            : undefined;
    const apiKey = options.apiKey ?? envKey;

    if (!apiKey) {
        return textResponse("Server missing OpenRouter API key.", {
            status: 500
        });
    }

    try {
        const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
        const parsed = (await readJsonBodyLimited(request, maxBytes)) as any;

        const body: ProxyChatRequestBody = {
            model: String(parsed?.model ?? ""),
            messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
            fallbackModels: Array.isArray(parsed?.fallbackModels)
                ? parsed.fallbackModels
                : undefined,
            siteUrl:
                typeof parsed?.siteUrl === "string" ? parsed.siteUrl : undefined,
            siteName:
                typeof parsed?.siteName === "string"
                    ? parsed.siteName
                    : undefined
        };

        if (!body.model) {
            return jsonResponse({ error: "`model` is required." }, { status: 400 });
        }
        if (body.messages.length === 0) {
            return jsonResponse(
                { error: "`messages` must be a non-empty array." },
                { status: 400 }
            );
        }

        const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        };
        if (body.siteUrl) headers["HTTP-Referer"] = body.siteUrl;
        if (body.siteName) headers["X-Title"] = body.siteName;

        const orBody: Record<string, unknown> = {
            model: body.model,
            messages: body.messages
        };

        if (body.fallbackModels && body.fallbackModels.length > 0) {
            const seen = new Set<string>();
            const deduped = [body.model, ...body.fallbackModels].filter(m => {
                if (!m || seen.has(m)) return false;
                seen.add(m);
                return true;
            });
            orBody.models = deduped.slice(0, 3);
        }

        const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
        const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(orBody)
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => "");
            return jsonResponse(
                {
                    error: `OpenRouter request failed (${res.status}): ${errText || res.statusText}`
                },
                { status: 502 }
            );
        }

        const data = await res.json();
        const reply = pickReply(data);
        if (!reply) {
            return jsonResponse(
                { error: "OpenRouter returned an unexpected response shape." },
                { status: 502 }
            );
        }

        const resp = jsonResponse({ reply });
        if (origin) {
            (resp.headers as any).set?.("Access-Control-Allow-Origin", origin);
            resp.headers.set("Vary", "Origin");
        }
        return resp;
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return jsonResponse({ error: msg }, { status: 400 });
    }
}

