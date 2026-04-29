'use client'
import { useState } from "react";
import { ChatWidget } from "../src";

const INLINE_CONTEXT = `Sue is a frontend engineer based in Malaysia who specializes in
React, TypeScript, and design systems.

Projects:
- AI Chat Widget: an embeddable chat widget that uses Fuse.js for retrieval
  and OpenRouter free models for generation. The widget answers only from a
  provided text knowledge base.
- Portfolio Site: a personal site built with Vite, deployed on Vercel.

Skills: React, TypeScript, Vite, Tailwind CSS, Node.js, accessibility.

Contact: suriyanti.panagen@gmail.com
Availability: open to freelance frontend work in 2026.`;

export default function App() {
    const [source, setSource] = useState<"inline" | "file">("inline");

    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as
        | string
        | undefined;

    return (
        <div
            style={{
                fontFamily: "system-ui, sans-serif",
                maxWidth: 720,
                margin: "60px auto",
                padding: "0 20px",
                color: "#222"
            }}
        >
            <h1>Chat Widget Playground</h1>
            <p>
                Use the floating button in the
                bottom-right to chat. Answers are constrained to the context
                source selected below.
            </p>

            {!apiKey && (
                <div
                    style={{
                        background: "#fff4e5",
                        border: "1px solid #ffb74d",
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 16
                    }}
                >
                    <strong>No API key detected.</strong> Create a file named{" "}
                    <code>.env.local</code> in the project root with:
                    <pre style={{ margin: "8px 0 0" }}>
                        VITE_OPENROUTER_API_KEY=sk-or-...
                    </pre>
                </div>
            )}

            <fieldset
                style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 24
                }}
            >
                <legend>Context source</legend>
                <label style={{ marginRight: 16 }}>
                    <input
                        type="radio"
                        name="source"
                        checked={source === "inline"}
                        onChange={() => setSource("inline")}
                    />{" "}
                    Inline string
                </label>
                <label>
                    <input
                        type="radio"
                        name="source"
                        checked={source === "file"}
                        onChange={() => setSource("file")}
                    />{" "}
                    Fetch <code>/sample-context.txt</code>
                </label>
            </fieldset>

            <h2>Try asking</h2>
            <ul>
                <li>"What projects has Sue built?"</li>
                <li>"Is Sue available for freelance work?"</li>
                <li>
                    "What's the capital of France?" (should refuse — outside
                    context)
                </li>
            </ul>

            {source === "inline" ? (
                <ChatWidget
                    key="inline"
                    apiKey={apiKey ?? ""}
                    context={INLINE_CONTEXT}
                    title="Ask about Sue (inline)"
                    siteName="Chat Widget Playground"
                />
            ) : (
                <ChatWidget
                    key="file"
                    apiKey={apiKey ?? ""}
                    contextUrl="/sample-context.txt"
                    title="Ask about Sue (file)"
                    siteName="Chat Widget Playground"
                />
            )}
        </div>
    );
}
