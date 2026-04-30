export type ChatRole = "user" | "bot";

export type ChatMessage = {
    role: ChatRole;
    text: string;
};

export type ChatWidgetProps = {
    /**
     * OpenRouter API key.
     *
     * SECURITY WARNING: This is sent from the browser, so the key
     * will be visible to anyone inspecting network traffic. Only use
     * a key with strict spend limits, or proxy requests through your
     * own backend in production.
     */
    apiKey: string;

    /**
     * Raw text content the assistant is allowed to reference.
     * Either `context` or `contextUrl` must be provided.
     */
    context?: string;

    /**
     * URL to a context document. If the response is JSON (or the URL ends
     * in `.json`), it will be parsed and pretty-printed into text.
     * Otherwise, it is treated as plain text.
     *
     * Either `context` or `contextUrl` must be provided.
     */
    contextUrl?: string;

    /**
     * Primary OpenRouter model slug. Defaults to `openrouter/free`,
     * an auto-router that picks an available free model for you.
     * See https://openrouter.ai/models for options.
     */
    model?: string;

    /**
     * Optional list of fallback model slugs. If the primary model is
     * unavailable (e.g. rate-limited), OpenRouter will try these in
     * order. See https://openrouter.ai/docs/features/model-routing
     */
    fallbackModels?: string[];

    /** Title shown in the chat header. */
    title?: string;

    /** First message displayed from the assistant. */
    initialMessage?: string;

    /**
     * Override the system prompt. The retrieved context is appended
     * after this prompt automatically.
     */
    systemPrompt?: string;

    /** How many context chunks to retrieve per query (default 4). */
    topK?: number;

    /**
     * Optional HTTP-Referer header for OpenRouter analytics/ranking.
     * (Browsers will set the actual `Referer` automatically — this
     * is the OpenRouter-specific opt-in header.)
     */
    siteUrl?: string;

    /** Optional X-Title header for OpenRouter analytics/ranking. */
    siteName?: string;
};

export type EmbedChatWidgetOptions = ChatWidgetProps & {
    /**
     * DOM mount target. If a string, it is passed to `document.querySelector`.
     * If omitted, an empty `div` is appended to `document.body`.
     */
    container?: HTMLElement | string;
};

export type EmbedChatWidgetHandle = {
    /** Unmounts React and, if the library created the root element, removes it from the DOM. */
    unmount: () => void;
    /** Shallow-merges into the current props and re-renders. */
    update: (props: Partial<ChatWidgetProps>) => void;
};
