import type { AIProvider, ChatCompletionRequest, LLMMessage } from "./chat/types";
import { openAIChatCompletionSSEStream } from "./providers/openaiCompatSSE";
import { createOpenRouterProvider } from "./providers/openrouter";

export type { AIProvider, ChatCompletionRequest, LLMMessage } from "./chat/types";
export {
    createOpenRouterProvider,
    type CreateOpenRouterProviderOptions
} from "./providers/openrouter";

export type ProxyChatRequestBody = {
    model: string;
    fallbackModels?: string[];
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    siteUrl?: string;
    siteName?: string;
    /** When true, returns OpenAI-compatible SSE (`text/event-stream`). */
    stream?: boolean;
};

export type ProxyChatHandlerOptions = {
    /**
     * Configured LLM adapter. When omitted, the handler builds an OpenRouter
     * provider from `apiKey` / `OPENROUTER_API_KEY` (and optional `endpoint`).
     */
    provider?: AIProvider;
    /**
     * Provider API key (server-only). Used only when `provider` is omitted.
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
     * Override OpenRouter endpoint. Rarely needed. Ignored when `provider` is set.
     */
    endpoint?: string;
    /**
     * Optional max request bytes guard (default ~64KB).
     */
    maxBodyBytes?: number;
};

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

function toLLMMessages(messages: unknown): LLMMessage[] {
    if (!Array.isArray(messages)) return [];
    return messages.filter(
        (m): m is LLMMessage =>
            !!m &&
            typeof m === "object" &&
            (m.role === "system" || m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
    );
}

function resolveDefaultProvider(
    options: ProxyChatHandlerOptions
): AIProvider | Response {
    if (options.provider) return options.provider;

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

    return createOpenRouterProvider({
        apiKey,
        endpoint: options.endpoint
    });
}

/**
 * Web-standard proxy handler for `/api/chat` (Next.js App Router, Remix, Workers, etc).
 *
 * - Accepts POST JSON: `{ model, messages, fallbackModels?, siteUrl?, siteName? }`
 * - Calls the configured provider (OpenRouter by default) server-side
 * - Returns JSON: `{ reply: string }`, or when `stream: true` in the request body,
 *   returns `text/event-stream` (OpenAI-compatible SSE).
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

    const providerOrError = resolveDefaultProvider(options);
    if (providerOrError instanceof Response) return providerOrError;
    const provider = providerOrError;

    try {
        const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
        const parsed = (await readJsonBodyLimited(request, maxBytes)) as {
            model?: unknown;
            messages?: unknown;
            fallbackModels?: unknown;
            siteUrl?: unknown;
            siteName?: unknown;
            stream?: unknown;
        };

        const body: ProxyChatRequestBody = {
            model: String(parsed?.model ?? ""),
            messages: toLLMMessages(parsed?.messages),
            fallbackModels: Array.isArray(parsed?.fallbackModels)
                ? parsed.fallbackModels.filter(
                      (m): m is string => typeof m === "string"
                  )
                : undefined,
            siteUrl:
                typeof parsed?.siteUrl === "string" ? parsed.siteUrl : undefined,
            siteName:
                typeof parsed?.siteName === "string"
                    ? parsed.siteName
                    : undefined,
            stream: parsed?.stream === true
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

        const req: ChatCompletionRequest = {
            model: body.model,
            messages: body.messages,
            stream: body.stream === true,
            extras: {
                fallbackModels: body.fallbackModels,
                siteUrl: body.siteUrl,
                siteName: body.siteName
            }
        };

        try {
            if (body.stream === true) {
                const streamHeaders = new Headers({
                    "Content-Type": "text/event-stream; charset=utf-8",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
                    "X-Accel-Buffering": "no"
                });
                if (origin) {
                    streamHeaders.set("Access-Control-Allow-Origin", origin);
                    streamHeaders.set("Vary", "Origin");
                }
                return new Response(
                    openAIChatCompletionSSEStream(onDelta =>
                        provider.stream(req, onDelta)
                    ),
                    { status: 200, headers: streamHeaders }
                );
            }

            const reply = await provider.complete(req);
            const resp = jsonResponse({ reply });
            if (origin) {
                (resp.headers as any).set?.("Access-Control-Allow-Origin", origin);
                resp.headers.set("Vary", "Origin");
            }
            return resp;
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            return jsonResponse({ error: msg }, { status: 502 });
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return jsonResponse({ error: msg }, { status: 400 });
    }
}
