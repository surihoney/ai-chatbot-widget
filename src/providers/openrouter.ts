import type { AIProvider, ChatCompletionRequest, LLMMessage } from "../chat/types";
import { getExtrasString, getExtrasStringArray } from "../chat/types";
import { consumeOpenAIChatCompletionStream } from "./openaiCompatSSE";

export const OPENROUTER_CHAT_COMPLETIONS_URL =
    "https://openrouter.ai/api/v1/chat/completions";

export type CreateOpenRouterProviderOptions = {
    apiKey: string;
    endpoint?: string;
};

function buildRequestBody(
    model: string,
    fallbackModels: string[] | undefined,
    messages: LLMMessage[],
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

function requestHeaders(
    apiKey: string,
    extras: Record<string, unknown> | undefined
): Record<string, string> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    };
    const siteUrl = getExtrasString(extras, "siteUrl");
    const siteName = getExtrasString(extras, "siteName");
    if (siteUrl) headers["HTTP-Referer"] = siteUrl;
    if (siteName) headers["X-Title"] = siteName;
    return headers;
}

async function postChatCompletions(
    endpoint: string,
    apiKey: string,
    req: ChatCompletionRequest,
    stream: boolean
): Promise<Response> {
    const fallbackModels = getExtrasStringArray(req.extras, "fallbackModels");
    const res = await fetch(endpoint, {
        method: "POST",
        headers: requestHeaders(apiKey, req.extras),
        body: JSON.stringify(
            buildRequestBody(req.model, fallbackModels, req.messages, stream)
        ),
        signal: req.signal
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
            `OpenRouter request failed (${res.status}): ${errText || res.statusText}`
        );
    }

    return res;
}

export function createOpenRouterProvider(
    options: CreateOpenRouterProviderOptions
): AIProvider {
    const endpoint = options.endpoint ?? OPENROUTER_CHAT_COMPLETIONS_URL;

    return {
        id: "openrouter",

        async complete(req: ChatCompletionRequest): Promise<string> {
            const res = await postChatCompletions(
                endpoint,
                options.apiKey,
                req,
                false
            );
            const data = await res.json();
            const reply = data?.choices?.[0]?.message?.content;
            if (typeof reply !== "string") {
                throw new Error(
                    "OpenRouter returned an unexpected response shape."
                );
            }
            return reply.trim();
        },

        async stream(
            req: ChatCompletionRequest,
            onDelta: (chunk: string) => void
        ): Promise<void> {
            const res = await postChatCompletions(
                endpoint,
                options.apiKey,
                req,
                true
            );
            await consumeOpenAIChatCompletionStream(res, onDelta, req.signal);
        }
    };
}
