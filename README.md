# @surihoney/chatbot-widget

[![npm version](https://img.shields.io/npm/v/@surihoney/chatbot-widget.svg)](https://www.npmjs.com/package/@surihoney/chatbot-widget)

A lightweight, context-aware, embeddable AI chat widget built with React, TypeScript, and Vite. It answers questions strictly from a text knowledge base you provide, using:

- **[Fuse.js](https://www.fusejs.io/)** for client-side fuzzy retrieval over your text
- **[OpenRouter](https://openrouter.ai/)** chat completions (free models supported) for the answer

The assistant is system-prompted to refuse questions that are not covered by the provided context, so it acts as a focused FAQ bot rather than a general-purpose chatbot.

## Install

```bash
npm install @surihoney/chatbot-widget react react-dom
```

### React / Next.js compatibility

This library targets **React 19** (peer dependency). For Next.js, that typically means **Next 15+**.

## Usage

Provide either a `context` string or a `contextUrl` pointing to a `.txt` file:

```tsx
import { ChatWidget } from "@surihoney/chatbot-widget";

export default function App() {
    return (
        <ChatWidget
            transport="proxy"
            proxyUrl="/api/chat"
            contextUrl="/knowledge.txt"
            title="Ask about Sue"
            initialMessage="Hi! Ask me about my portfolio."
            // Optional — defaults to "openrouter/free" (auto-routes free models)
            model="openrouter/free"
            fallbackModels={[
                "meta-llama/llama-3.3-70b-instruct:free",
                "google/gemma-3-27b-it:free"
            ]}
            siteUrl="https://your-site.example"
            siteName="Your Site"
        />
    );
}
```

### Streaming (`stream` prop)

Assistant replies **stream by default** — you do not need to pass `stream` in your widget setup; see the **`stream`** row in **Props** for the type and default. The widget may send `"stream": true` to your proxy; `handleChatProxyRequest` forwards OpenRouter’s SSE (`text/event-stream`) in that case.

To turn streaming off — for example your API only ever returns JSON — set **`stream={false}`** on `<ChatWidget />` (or `stream: false` in `embedChatWidget` options). Then the proxy should return `{ reply: string }` (or an OpenRouter-like JSON body) as a single response.
s
### Usage (proxy mode — recommended for production)

Instead of sending your OpenRouter key from the browser, point the widget at your backend (default: `"/api/chat"`). The backend should call OpenRouter server-side. With streaming enabled (default), it can return SSE via `handleChatProxyRequest`; with `stream={false}` on the widget, return `{ reply: string }` (or an OpenRouter-like JSON response) only.

```tsx
import { ChatWidget } from "@surihoney/chatbot-widget";

export default function App() {
    return (
        <ChatWidget
            transport="proxy"
            proxyUrl="/api/chat"
            contextUrl="/knowledge.txt"
            title="Support"
        />
    );
}
```

### Next.js proxy route (no key in browser)

In your Next.js app, create an API route and use the server helper exported by this package.

**App Router** (`app/api/chat/route.ts`):
s
```ts
import { handleChatProxyRequest } from "@surihoney/chatbot-widget/server";

export async function POST(req: Request) {
  return handleChatProxyRequest(req, {
    apiKey: process.env.OPENROUTER_API_KEY!
  });
}
```

Then set `OPENROUTER_API_KEY` on your server (do **not** use `NEXT_PUBLIC_`).

Or pass the context inline:

```tsx
<ChatWidget
    transport="proxy"
    proxyUrl="/api/chat"
    context={`Sue is a frontend engineer based in...

Projects:
- Project A: ...
- Project B: ...`}
/>
```

## Usage (function embed)

If you want to mount the widget from a plain script or a non-React codebase, use `embedChatWidget`. It renders the same `ChatWidget` internally, but you control mounting/unmounting.

```ts
import { embedChatWidget } from "@surihoney/chatbot-widget";

const widget = embedChatWidget({
    transport: "proxy",
    proxyUrl: "/api/chat",
    contextUrl: "/knowledge.txt",

    // Optional: mount target
    // - omitted: appends a div to document.body
    // - string: document.querySelector(selector)
    // - HTMLElement: mount into that element
    container: "#chatbot-root"
});

// Later
// widget.update({ title: "Support" });
// widget.unmount();
```

## Props

| Prop             | Type     | Required | Default                                  | Description                                                                 |
| ---------------- | -------- | -------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| `transport`      | `"proxy"` | no | `"proxy"` | How the widget sends requests. Use `"proxy"` to keep secrets out of the browser. |
| `proxyUrl`       | string   | no       | `"/api/chat"`                            | Backend endpoint that calls OpenRouter server-side. |
| `proxyHeaders`   | Record<string,string> | no | —                                    | Extra headers to send to `proxyUrl` (e.g. CSRF token).                      |
| `allowCrossOriginProxyUrl` | boolean | no | `false` | When `false`, the widget refuses to send chat content to a cross-origin `proxyUrl` to reduce accidental data exfiltration. Set to `true` only if you fully trust that endpoint. |
| `stream`         | boolean  | no       | `true`                                   | When `true`, uses SSE token streaming (default). Set `false` for a JSON-only proxy response (`{ reply }` / OpenRouter-shaped JSON). |
| `context`        | string   | one of   | —                                        | Raw text the assistant may reference.                                       |
| `contextUrl`     | string   | one of   | —                                        | URL to a plain text file fetched on mount.                                  |
| `model`          | string   | no       | `openrouter/free`                        | Any [OpenRouter model slug](https://openrouter.ai/models). The default is an auto-router that picks an available free model. |
| `fallbackModels` | string[] | no       | `["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free"]` | Tried in order if the primary `model` is unavailable. Uses [OpenRouter model routing](https://openrouter.ai/docs/features/model-routing). OpenRouter caps the combined list (primary + fallbacks) at **3 entries**; extras are dropped. |
| `title`          | string   | no       | `"AI Assistant"`                         | Header title.                                                               |
| `initialMessage` | string   | no       | `"Hi 👋 Ask me anything about this page."` | First bot message.                                                          |
| `systemPrompt`   | string   | no       | (built-in)                               | Override the system prompt. Retrieved context is appended automatically.    |
| `systemPromptAddon` | string | no     | —                                        | Extra system instructions appended (or prepended) to `systemPrompt` before the `CONTEXT:` section. |
| `systemPromptAddonPlacement` | `"before" \| "after"` | no | `"after"` | Where to place `systemPromptAddon` relative to `systemPrompt`. |
| `topK`           | number   | no       | `4`                                      | How many text chunks Fuse.js retrieves per query.                           |
| `siteUrl`        | string   | no       | —                                        | Sent as `HTTP-Referer` for OpenRouter analytics.                            |
| `siteName`       | string   | no       | —                                        | Sent as `X-Title` for OpenRouter analytics.                                 |
| `widgetAnchor`   | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | no | `"bottom-right"` | Which corner to pin the widget to.                                          |
| `widgetOffsetX`  | number   | no       | `20`                                     | Horizontal offset (px) from the chosen edge.                                |
| `widgetOffsetY`  | number   | no       | `20`                                     | Vertical offset (px) from the chosen edge.                                  |
| `panelGap`       | number   | no       | `60`                                     | Distance (px) between the floating button and the chat panel.               |
| `openChatButtonText` | string | no   | `"Chat"`                                 | Floating toggle button label when the panel is closed.                     |
| `closeChatButtonText` | string | no  | `"Close"`                                | Floating toggle button label when the panel is open.                       |
| `panelWidth`     | number   | no       | `320`                                    | Chat panel width (px).                                                      |
| `panelHeight`    | number   | no       | `450`                                    | Chat panel height (px).                                                     |
| `proactive`      | boolean  | no       | `false`                                  | Show a proactive prompt after the visitor is idle on the page.              |
| `proactiveMessage` | string | no       | `"Hi there! Can I help you with anything?"` | Message shown when the proactive prompt fires.                          |
| `proactiveDelay` | number   | no       | `30`                                     | Idle time before the proactive prompt appears.                              |
| `proactiveDelayUnit` | `"seconds" \| "minutes"` | no | `"seconds"`                        | Unit for `proactiveDelay`.                                                  |
| `proactiveOncePerSession` | boolean | no | `true`                              | Fire the proactive prompt at most once per browser tab session.             |

### Proactive chat

After a configurable idle period, the widget shows a speech bubble above the launcher. The chat panel stays closed until the visitor clicks the bubble.

```tsx
<ChatWidget
  contextUrl="/knowledge.txt"
  proactive
  proactiveDelay={45}
  proactiveDelayUnit="seconds"
  proactiveMessage="Need help finding something?"
/>
```

Use `proactiveDelayUnit="minutes"` for longer waits (e.g. `proactiveDelay={2}` → 2 minutes). Idle time resets on mouse, keyboard, scroll, or touch activity. The timer pauses while the tab is hidden.

### Customizing the system prompt (prepend/append)

Append extra instructions (default placement is `"after"`):

```tsx
<ChatWidget
  contextUrl="/knowledge.txt"
  systemPromptAddon="Always answer in Bahasa Malaysia."
/>
```

Prepend extra instructions:

```tsx
<ChatWidget
  contextUrl="/knowledge.txt"
  systemPromptAddon="You are a strict customer support agent."
  systemPromptAddonPlacement="before"
/>
```

### `embedChatWidget` options

`embedChatWidget(options)` accepts all `ChatWidget` props plus:

- `container?: HTMLElement | string` — where to mount. If omitted, a new `div` is appended to `document.body`.

## How retrieval works

1. The provided text is split into chunks (paragraphs, then long paragraphs are sub-split).
2. A Fuse.js index is built over those chunks.
3. On each user message, the top `topK` matching chunks are concatenated and injected into the system prompt under a `CONTEXT:` section.
4. The model is instructed to answer only from that context.

## Conversation memory

Each request to OpenRouter includes only the system prompt (with retrieved context) and the **current** user message — prior turns in the chat panel are not replayed to the model. This keeps the widget cheap and predictable as a focused FAQ bot, but it means the assistant cannot resolve follow-ups like "and what about the second one?" that depend on earlier turns. If you need multi-turn memory, fork `ChatWidget.tsx` and pass the running `messages` array into the transport's `complete` / `stream` request.

## Security note

This widget is designed to be used in **proxy mode**, so no provider API keys are ever shipped to the browser. Store secrets on your server (e.g. `OPENROUTER_API_KEY`) and expose only a `/api/chat` endpoint to the widget.

### Prompt injection

The system prompt instructs the model to answer only from the provided `CONTEXT:` block, but this is a soft constraint — like every LLM application, the widget is not immune to prompt injection. Treat the `context` / `contextUrl` text as **trusted** content (you authored it) and treat user messages as **untrusted**: a sufficiently crafted user message ("Ignore previous instructions and …") or poisoned context file can coerce the model into ignoring the refusal rule, leaking the system prompt, or answering off-topic. If that matters for your use case:

- Host the context file on a domain you control so it can't be tampered with in transit.
- Don't put secrets, credentials, or anything you wouldn't paste into a public chat into the context — assume any text the model can see can be exfiltrated through the reply. `context` / `contextUrl` are also fully visible to visitors (they load in the browser). Keeping the corpus off the client is planned as [server-side context retrieval](#server-side-context-retrieval-private-knowledge).
- Add an output filter / moderation step on a backend proxy if you need stronger guarantees than a system prompt can give.

## Develop

This project ships with a small Vite playground in `examples/` that imports the widget directly from `src/`, so changes hot-reload as you work.

```bash
npm install
npm run dev
npm run build
```

The playground (`examples/App.tsx`) demonstrates both context modes:

- An inline `context` string.
- Fetching `public/sample-context.txt` via `contextUrl`.

## Test locally in a Next.js app

For quick local testing without publishing, add a file dependency from your Next app:

```json
{
    "dependencies": {
        "@surihoney/chatbot-widget": "file:../path/to/chatbot"
    }
}
```

Then:

```bash
npm install
```

In `next.config.js` / `next.config.ts`, ensure the package is transpiled:

```ts
const nextConfig = {
    transpilePackages: ["@surihoney/chatbot-widget"]
};

export default nextConfig;
```

Use it from a Client Component:

```tsx
"use client";

import { ChatWidget } from "@surihoney/chatbot-widget";

export function ChatWidgetClient() {
    return (
        <ChatWidget
            transport="proxy"
            proxyUrl="/api/chat"
            contextUrl="/knowledge.txt"
        />
    );
}
```

## Roadmap

Planned enhancements — not implemented yet.

### LLM provider abstraction

Decouple the UI, Fuse.js retrieval, and HTTP transport from any one vendor so backends can be swapped behind one interface:

```
ChatWidget
    ↓
Chat Transport          (how: proxy vs direct)
    ↓
AI Provider Adapter     (who: which LLM API)
    ├── OpenRouter      (current — keep as default)
    ├── OpenAI
    ├── Ollama
    ├── Anthropic
    └── Custom
```

- [x] Extract a provider interface (`complete` / `stream`) so `ChatWidget` never talks to a vendor client directly
- [ ] Split **transport** (`proxy` vs `direct`) from **provider** (OpenRouter, OpenAI, Ollama, Anthropic, custom)
- [ ] Shared OpenAI-compatible client reused by OpenRouter, OpenAI, and Ollama (`/v1/chat/completions`)
- [ ] First-party adapters: **OpenAI**, **Ollama**, **Anthropic** (Anthropic needs its own message/SSE mapping)
- [ ] Custom provider: OpenAI-compatible `baseUrl`, plus an injected adapter escape hatch for internal APIs
- [x] Server helper: `handleChatProxyRequest` takes a configured provider instead of always calling OpenRouter
- [ ] Keep existing proxy-mode and OpenRouter props working (backward compatible)

### Server-side context retrieval (private knowledge)

Today retrieval is **client-side**: the widget loads the full `context` / `contextUrl` corpus in the browser, runs Fuse.js there, and injects the top chunks into the system prompt before calling the proxy. That means the knowledge base is public to anyone who inspects the page, the network tab, or the `contextUrl` file. Proxy mode already keeps the **API key** off the client; it does **not** keep the **corpus** off the client.

**Yes, private context is possible** — by moving retrieval to the same server that already owns `OPENROUTER_API_KEY`. The widget would send only the user message; the server would load the corpus, retrieve chunks, build `CONTEXT:`, and call the LLM. The browser never downloads the knowledge base.

```
Today (client retrieval)              Private mode (server retrieval)
─────────────────────────            ────────────────────────────────
Browser: fetch corpus                Browser: POST user message only
Browser: Fuse.js topK                Server: load private corpus
Browser: build CONTEXT               Server: Fuse.js (or embeddings) topK
Browser → proxy: prompt + chunks     Server: build CONTEXT + call LLM
                                     Browser ← reply only
```

- [ ] Optional **server retrieval mode**: omit `context` / `contextUrl` on the widget; `handleChatProxyRequest` (or a sibling helper) runs chunk + Fuse.js on a server-held corpus
- [ ] Widget still works with current client-side `context` / `contextUrl` (backward compatible; public FAQ / portfolio text stays as-is)
- [ ] Server accepts a corpus via file path, string, or loader callback — never exposed as a public URL
- [ ] Later: optional **embeddings RAG** as an alternative to Fuse.js on the server (not required for the privacy goal)

**What this does and does not guarantee**

- **Does:** the full knowledge file is not shipped to visitors. Same trust boundary as the API key.
- **Does not:** stop the model from quoting retrieved snippets in the reply. Do not put credentials or secrets in the corpus even in server mode — see [Prompt injection](#prompt-injection).
- **Does not:** add per-user auth. Private *to the site* is in scope; per-visitor documents would need session checks on the proxy on top of this.

### Other enhancements

Items that were intentionally left out of the provider refactor, for later:

- [ ] **Multi-turn conversation memory** — send prior chat turns to the model, not only the current user message
- [ ] **Generation knobs** — `temperature`, `maxTokens`, and similar extras on the completion request
- [ ] **Native Ollama `/api/chat`** — NDJSON streaming if OpenAI-compat mode is not enough
- [ ] **Multi-provider proxy route** — let one `/api/chat` pick a provider from an allowlist (one adapter per server remains the v1 design)
- [ ] **Tool calling and vision** — out of scope until the provider layer exists
- [ ] **Playground provider selector** — switch OpenRouter / OpenAI / Ollama / Anthropic in `examples/`


## License

MIT
