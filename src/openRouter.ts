import { createOpenRouterProvider } from "./providers/openrouter";
import type { LLMMessage } from "./chat/types";

export type OpenRouterMessage = LLMMessage;

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

export { consumeOpenAIChatCompletionStream } from "./providers/openaiCompatSSE";

function providerFromArgs(args: CallOpenRouterArgs) {
    return createOpenRouterProvider({ apiKey: args.apiKey });
}

function completionRequest(args: CallOpenRouterArgs) {
    return {
        model: args.model,
        messages: args.messages,
        signal: args.signal,
        extras: {
            fallbackModels: args.fallbackModels,
            siteUrl: args.siteUrl,
            siteName: args.siteName
        }
    };
}

/** @deprecated Use `createOpenRouterProvider().stream` instead. */
export async function streamOpenRouter({
    onDelta,
    ...args
}: CallOpenRouterArgs & { onDelta: (chunk: string) => void }): Promise<void> {
    await providerFromArgs(args).stream(completionRequest(args), onDelta);
}

/** @deprecated Use `createOpenRouterProvider().complete` instead. */
export async function callOpenRouter(
    args: CallOpenRouterArgs
): Promise<string> {
    return providerFromArgs(args).complete(completionRequest(args));
}
