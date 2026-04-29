'use client'
import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import type { ChatMessage, ChatWidgetProps } from "./types";
import { chunkText } from "./context";
import { callOpenRouter, type OpenRouterMessage } from "./openRouter";

const DEFAULT_MODEL = "openrouter/free";

// OpenRouter caps the `models` array at 3, so we keep 2 fallbacks
// (primary + 2 = 3).
const DEFAULT_FALLBACK_MODELS: string[] = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-27b-it:free"
];

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant embedded on a website.
You MUST answer using ONLY the information in the "CONTEXT" section below.
If the answer is not contained in the context, reply exactly:
"I don't have that information in my knowledge base."
Keep answers concise and do not invent facts.`;

export default function ChatWidget({
    apiKey,
    context,
    contextUrl,
    model = DEFAULT_MODEL,
    fallbackModels = DEFAULT_FALLBACK_MODELS,
    title = "AI Assistant",
    initialMessage = "Hi 👋 Ask me anything about this page.",
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    topK = 4,
    siteUrl,
    siteName
}: ChatWidgetProps) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [contextText, setContextText] = useState<string>(context ?? "");
    const [contextError, setContextError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: "bot", text: initialMessage }
    ]);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (context !== undefined) {
            setContextText(context);
            return;
        }
        if (!contextUrl) return;

        let cancelled = false;
        setContextError(null);
        fetch(contextUrl)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
            })
            .then(t => {
                if (!cancelled) setContextText(t);
            })
            .catch(err => {
                if (!cancelled)
                    setContextError(
                        `Failed to load context: ${err.message ?? err}`
                    );
            });

        return () => {
            cancelled = true;
        };
    }, [context, contextUrl]);

    const chunks = useMemo(() => chunkText(contextText), [contextText]);

    const fuse = useMemo(
        () =>
            new Fuse(chunks, {
                includeScore: true,
                ignoreLocation: true,
                threshold: 0.4,
                minMatchCharLength: 2
            }),
        [chunks]
    );

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const retrieveContext = (query: string): string => {
        if (chunks.length === 0) return "";
        const results = fuse.search(query, { limit: topK });
        const picked =
            results.length > 0
                ? results.map(r => r.item)
                : chunks.slice(0, topK);
        return picked
            .map((c, i) => `[${i + 1}] ${c}`)
            .join("\n\n");
    };

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        if (!apiKey) {
            setMessages(prev => [
                ...prev,
                { role: "user", text: trimmed },
                {
                    role: "bot",
                    text: "Missing OpenRouter API key. Please configure the widget."
                }
            ]);
            setInput("");
            return;
        }

        const userMsg: ChatMessage = { role: "user", text: trimmed };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const retrieved = retrieveContext(trimmed);
            const systemContent = retrieved
                ? `${systemPrompt}\n\nCONTEXT:\n${retrieved}`
                : `${systemPrompt}\n\nCONTEXT: (none provided)`;

            const orMessages: OpenRouterMessage[] = [
                { role: "system", content: systemContent },
                { role: "user", content: trimmed }
            ];

            const reply = await callOpenRouter({
                apiKey,
                model,
                fallbackModels,
                messages: orMessages,
                siteUrl,
                siteName
            });

            setMessages(prev => [...prev, { role: "bot", text: reply }]);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            setMessages(prev => [
                ...prev,
                { role: "bot", text: `⚠️ ${message}` }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(!open)}
                aria-label={open ? "Close chat" : "Open chat"}
                style={{
                    position: "fixed",
                    bottom: 20,
                    right: 20,
                    padding: "12px 16px",
                    borderRadius: 999,
                    background: "#000",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    zIndex: 9999
                }}
            >
                {open ? "Close" : "Chat"}
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label={title}
                    style={{
                        position: "fixed",
                        bottom: 80,
                        right: 20,
                        width: 320,
                        height: 450,
                        background: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: 12,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        zIndex: 9999,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
                    }}
                >
                    <div
                        style={{
                            padding: 12,
                            borderBottom: "1px solid #eee",
                            fontWeight: "bold"
                        }}
                    >
                        {title}
                    </div>

                    <div
                        style={{
                            flex: 1,
                            padding: 12,
                            overflowY: "auto",
                            background: "#fafafa"
                        }}
                    >
                        {contextError && (
                            <div
                                style={{
                                    color: "#b00020",
                                    fontSize: 12,
                                    marginBottom: 8
                                }}
                            >
                                {contextError}
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                style={{
                                    textAlign:
                                        msg.role === "user"
                                            ? "right"
                                            : "left",
                                    marginBottom: 8
                                }}
                            >
                                <span
                                    style={{
                                        display: "inline-block",
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        background:
                                            msg.role === "user"
                                                ? "#000"
                                                : "#f2f2f2",
                                        color:
                                            msg.role === "user"
                                                ? "#fff"
                                                : "#000",
                                        whiteSpace: "pre-wrap",
                                        maxWidth: "85%",
                                        wordBreak: "break-word"
                                    }}
                                >
                                    {msg.text}
                                </span>
                            </div>
                        ))}

                        {loading && (
                            <div
                                style={{
                                    textAlign: "left",
                                    color: "#888",
                                    fontStyle: "italic",
                                    fontSize: 13
                                }}
                            >
                                Thinking…
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            padding: 10,
                            borderTop: "1px solid #eee"
                        }}
                    >
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            disabled={loading}
                            placeholder="Ask something..."
                            style={{
                                flex: 1,
                                padding: 8,
                                borderRadius: 6,
                                border: "1px solid #ddd"
                            }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={loading || !input.trim()}
                            style={{
                                padding: "8px 12px",
                                borderRadius: 6,
                                border: "none",
                                background: "#000",
                                color: "#fff",
                                cursor:
                                    loading || !input.trim()
                                        ? "not-allowed"
                                        : "pointer",
                                opacity: loading || !input.trim() ? 0.6 : 1
                            }}
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
