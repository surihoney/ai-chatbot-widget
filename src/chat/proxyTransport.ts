import { consumeOpenAIChatCompletionStream } from "../providers/openaiCompatSSE";
import type { ChatCompletionRequest, ChatTransport } from "./types";
import { getExtrasString, getExtrasStringArray } from "./types";

export type ProxyTransportOptions = {
    proxyUrl: string;
    proxyHeaders?: Record<string, string>;
};

function proxyBody(req: ChatCompletionRequest, stream: boolean): unknown {
    return {
        model: req.model,
        fallbackModels: getExtrasStringArray(req.extras, "fallbackModels"),
        messages: req.messages,
        siteUrl: getExtrasString(req.extras, "siteUrl"),
        siteName: getExtrasString(req.extras, "siteName"),
        ...(stream ? { stream: true } : {})
    };
}

function pickReply(data: {
    reply?: unknown;
    message?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
}): string | null {
    const reply =
        (typeof data?.reply === "string" && data.reply) ||
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.choices?.[0]?.message?.content === "string" &&
            data.choices[0].message.content);
    return typeof reply === "string" ? reply.trim() : null;
}

export function createProxyTransport(
    options: ProxyTransportOptions
): ChatTransport {
    return {
        async complete(req: ChatCompletionRequest): Promise<string> {
            const res = await fetch(options.proxyUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(options.proxyHeaders ?? {})
                },
                body: JSON.stringify(proxyBody(req, false)),
                signal: req.signal
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                throw new Error(
                    `Proxy request failed (${res.status}): ${errText || res.statusText}`
                );
            }

            const contentType = res.headers.get("content-type") ?? "";
            const looksJson = contentType.toLowerCase().includes("application/json");
            if (!looksJson) {
                const t = await res.text();
                return t.trim();
            }

            const data = (await res.json()) as Parameters<typeof pickReply>[0];
            const reply = pickReply(data);
            if (reply === null) {
                throw new Error("Proxy returned an unexpected response shape.");
            }
            return reply;
        },

        async stream(
            req: ChatCompletionRequest,
            onDelta: (chunk: string) => void
        ): Promise<void> {
            const res = await fetch(options.proxyUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(options.proxyHeaders ?? {})
                },
                body: JSON.stringify(proxyBody(req, true)),
                signal: req.signal
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                throw new Error(
                    `Proxy request failed (${res.status}): ${errText || res.statusText}`
                );
            }

            const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
            if (contentType.includes("text/event-stream")) {
                await consumeOpenAIChatCompletionStream(
                    res,
                    onDelta,
                    req.signal
                );
                return;
            }

            const raw = await res.text();
            const looksJson =
                contentType.includes("application/json") ||
                raw.trim().startsWith("{");
            if (looksJson) {
                let data: Parameters<typeof pickReply>[0];
                try {
                    data = JSON.parse(raw) as Parameters<typeof pickReply>[0];
                } catch {
                    throw new Error("Proxy returned invalid JSON.");
                }
                const reply = pickReply(data);
                if (reply === null) {
                    throw new Error("Proxy returned an unexpected response shape.");
                }
                onDelta(reply);
                return;
            }

            onDelta(raw.trim());
        }
    };
}
