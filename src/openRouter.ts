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

    const body: Record<string, unknown> = { model, messages };
    if (fallbackModels && fallbackModels.length > 0) {
        const seen = new Set<string>();
        const deduped = [model, ...fallbackModels].filter(m => {
            if (!m || seen.has(m)) return false;
            seen.add(m);
            return true;
        });
        // OpenRouter caps the `models` array at 3 entries.
        body.models = deduped.slice(0, 3);
    }

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
