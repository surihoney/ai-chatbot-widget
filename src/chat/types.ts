export type LLMRole = "system" | "user" | "assistant";

export type LLMMessage = {
    role: LLMRole;
    content: string;
};

export type ChatCompletionRequest = {
    messages: LLMMessage[];
    model: string;
    stream?: boolean;
    signal?: AbortSignal;
    /**
     * Provider-specific knobs the adapter may honor or ignore.
     * Examples: fallbackModels, siteUrl, siteName.
     */
    extras?: Record<string, unknown>;
};

export type AIProvider = {
    readonly id: string;
    complete(req: ChatCompletionRequest): Promise<string>;
    stream(
        req: ChatCompletionRequest,
        onDelta: (chunk: string) => void
    ): Promise<void>;
};

export type ChatTransport = {
    complete(req: ChatCompletionRequest): Promise<string>;
    stream(
        req: ChatCompletionRequest,
        onDelta: (chunk: string) => void
    ): Promise<void>;
};

export function getExtrasString(
    extras: Record<string, unknown> | undefined,
    key: string
): string | undefined {
    const value = extras?.[key];
    return typeof value === "string" ? value : undefined;
}

export function getExtrasStringArray(
    extras: Record<string, unknown> | undefined,
    key: string
): string[] | undefined {
    const value = extras?.[key];
    if (!Array.isArray(value)) return undefined;
    return value.filter((item): item is string => typeof item === "string");
}
