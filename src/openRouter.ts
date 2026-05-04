export type OpenRouterMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

export type CallOpenRouterArgs = {
    apiKey: string;
    model: string;
    /**
     * Optional fallback model slugs. When provided, the request uses
     * OpenRouter's native fallback routing: if the primary model is
     * unavailable (rate-limited, errored, etc.), OpenRouter tries each
     * fallback in order. See https://openrouter.ai/docs/features/model-routing
     */
    fallbackModels?: string[];
    messages: OpenRouterMessage[];
    siteUrl?: string;
    siteName?: string;
    signal?: AbortSignal;
};

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

function buildRequestBody(
    model: string,
    fallbackModels: string[] | undefined,
    messages: OpenRouterMessage[],
    stream: boolean
): Record<string, unknown> {
    const body: Record<string, unknown> = { model, messages, stream };
    if (fallbackModels && fallbackModels.length > 0) {
        const seen = new Set<string>();
        const deduped = [model, ...fallbackModels].filter(m => {
            if (!m || seen.has(m)) return false;
            seen.add(m);
            return true;
        });
        body.models = deduped.slice(0, 3);
    }
    return body;
}

/**
 * Reads an OpenAI-compatible chat completion SSE stream (`text/event-stream`)
 * and invokes `onDelta` for each text token chunk.
 */
export async function consumeOpenAIChatCompletionStream(
    response: Response,
    onDelta: (chunk: string) => void,
    signal?: AbortSignal
): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response has no readable body.");

    const decoder = new TextDecoder();
    let carry = "";

    try {
        while (true) {
            if (signal?.aborted) {
                await reader.cancel();
                throw new DOMException("Aborted", "AbortError");
            }
            const { done, value } = await reader.read();
            if (done) break;

            carry += decoder.decode(value, { stream: true });
            const lines = carry.split("\n");
            carry = lines.pop() ?? "";

            for (const line of lines) {
                const trimmed = line.replace(/\r$/, "").trimEnd();
                if (!trimmed || trimmed.startsWith(":")) continue;
                if (!trimmed.startsWith("data:")) continue;
                const data = trimmed.slice(5).trimStart();
                if (data === "[DONE]") return;

                try {
                    const json = JSON.parse(data) as {
                        choices?: Array<{
                            delta?: { content?: string | null };
                        }>;
                    };
                    const piece = json?.choices?.[0]?.delta?.content;
                    if (typeof piece === "string" && piece.length > 0) {
                        onDelta(piece);
                    }
                } catch {
                    // Ignore non-JSON SSE lines (e.g. heartbeats).
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export async function streamOpenRouter({
    apiKey,
    model,
    fallbackModels,
    messages,
    siteUrl,
    siteName,
    signal,
    onDelta
}: CallOpenRouterArgs & { onDelta: (chunk: string) => void }): Promise<void> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    };
    if (siteUrl) headers["HTTP-Referer"] = siteUrl;
    if (siteName) headers["X-Title"] = siteName;

    const body = buildRequestBody(model, fallbackModels, messages, true);

    const res = await fetch(ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
            `OpenRouter request failed (${res.status}): ${errText || res.statusText}`
        );
    }

    await consumeOpenAIChatCompletionStream(res, onDelta, signal);
}

export async function callOpenRouter({
    apiKey,
    model,
    fallbackModels,
    messages,
    siteUrl,
    siteName,
    signal
}: CallOpenRouterArgs): Promise<string> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    };
    if (siteUrl) headers["HTTP-Referer"] = siteUrl;
    if (siteName) headers["X-Title"] = siteName;

    const body = buildRequestBody(model, fallbackModels, messages, false);

    const res = await fetch(ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
            `OpenRouter request failed (${res.status}): ${errText || res.statusText}`
        );
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string") {
        throw new Error("OpenRouter returned an unexpected response shape.");
    }
    return reply.trim();
}
