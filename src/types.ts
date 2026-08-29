export type ChatRole = "user" | "bot";

export type ChatMessage = {
    role: ChatRole;
    text: string;
};

export type WidgetAnchor =
    | "bottom-right"
    | "bottom-left"
    | "top-right"
    | "top-left";

export type ChatWidgetProps = {
    /**
     * OpenRouter API key.
     *
     * SECURITY WARNING: This is sent from the browser, so the key
     * will be visible to anyone inspecting network traffic. Only use
     * a key with strict spend limits, or proxy requests through your
     * own backend in production.
     */
    apiKey?: string;

    /**
     * How the widget should send chat requests:
     * - "auto" (default): uses OpenRouter if `apiKey` is provided; otherwise uses `proxyUrl`.
     * - "direct": call the LLM from the browser (currently OpenRouter; requires `apiKey`).
     * - "openrouter": alias of `"direct"` (kept for compatibility).
     * - "proxy": always call your backend `proxyUrl` (recommended for production).
     */
    transport?: "auto" | "openrouter" | "proxy" | "direct";

    /**
     * Backend endpoint used when `transport` is "proxy" (or when "auto" and no `apiKey`).
     *
     * The widget POSTs JSON with `{ model, messages, fallbackModels?, siteUrl?, siteName?, stream? }`.
     * JSON response shapes when `stream` is false are documented on the `stream` prop.
     *
     * Default: "/api/chat"
     */
    proxyUrl?: string;

    /**
     * Optional extra headers to include in the proxy request (e.g. CSRF token).
     * These are only used when `transport` resolves to "proxy".
     */
    proxyHeaders?: Record<string, string>;

    /**
     * If `proxyUrl` is cross-origin, the widget will refuse to send chat content
     * unless this is explicitly enabled.
     *
     * Default: false
     */
    allowCrossOriginProxyUrl?: boolean;

    /**
     * Enable streaming assistant output (SSE). **Defaults to `true` when omitted** — the widget requests
     * token-by-token delivery. Set explicitly to **`false`** to disable streaming and use a single JSON
     * completion only (for example a legacy proxy that always returns `{ reply: string }` and never SSE).
     *
     * When `true`: reads an SSE stream (OpenAI-compatible chat completion `data:` chunks). Direct
     * OpenRouter mode sends `stream: true` to the provider. Proxy mode includes `stream: true` in the
     * POST body; use `handleChatProxyRequest` from `@surihoney/chatbot-widget/server` or any route that
     * returns `text/event-stream`. If the proxy responds with JSON anyway, the widget still shows the
     * full reply once.
     *
     * When `false`: expects JSON — `{ reply: string }` or OpenRouter-like `choices[0].message.content`.
     * The proxy request body does not ask for streaming.
     */
    stream?: boolean;

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

    /**
     * Optional extra system instructions appended to `systemPrompt`.
     * Useful for per-embed customization without replacing the default prompt.
     */
    systemPromptAddon?: string;

    /**
     * Where to place `systemPromptAddon` relative to `systemPrompt`.
     * Default: "after"
     */
    systemPromptAddonPlacement?: "before" | "after";

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

    /**
     * Where to pin the widget on the page (default: "bottom-right").
     * Affects both the floating button and the chat panel.
     */
    widgetAnchor?: WidgetAnchor;

    /**
     * Horizontal offset in px from the chosen edge (default: 20).
     * Example: for "bottom-left", this is the distance from the left edge.
     */
    widgetOffsetX?: number;

    /**
     * Vertical offset in px from the chosen edge (default: 20).
     * Example: for "bottom-right", this is the distance from the bottom edge.
     */
    widgetOffsetY?: number;

    /**
     * Distance in px between the button and the chat panel (default: 60).
     * The panel is offset further from the same edge as the button.
     */
    panelGap?: number;

    /** Label on the floating toggle button when the chat panel is closed (default: "Chat"). */
    openChatButtonText?: string;

    /** Label on the floating toggle button when the chat panel is open (default: "Close"). */
    closeChatButtonText?: string;

    /** Chat panel width in px (default: 320). */
    panelWidth?: number;

    /** Chat panel height in px (default: 450). */
    panelHeight?: number;

    /**
     * Enable a proactive chat prompt after the visitor has been idle on the page.
     * Default: false
     */
    proactive?: boolean;

    /**
     * Message shown when the proactive prompt fires.
     * Default: "Hi there! Can I help you with anything?"
     */
    proactiveMessage?: string;

    /**
     * How long the visitor must be idle before the proactive prompt appears.
     * Default: 30
     */
    proactiveDelay?: number;

    /**
     * Unit for `proactiveDelay`: "seconds" (default) or "minutes".
     */
    proactiveDelayUnit?: "seconds" | "minutes";

    /**
     * Only fire the proactive prompt once per browser tab session.
     * Default: true
     */
    proactiveOncePerSession?: boolean;
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
