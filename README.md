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

### Usage (proxy mode — recommended for production)

Instead of sending your OpenRouter key from the browser, point the widget at your backend (default: `"/api/chat"`). The backend should call OpenRouter server-side and return `{ reply: string }` (or an OpenRouter-like response).

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

```ts
import { handleChatProxyRequest } from "@surihoney/chatbot-widget/server";

export async function POST(req: Request) {
    return handleChatProxyRequest(req);
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
| `context`        | string   | one of   | —                                        | Raw text the assistant may reference.                                       |
| `contextUrl`     | string   | one of   | —                                        | URL to a plain text file fetched on mount.                                  |
| `model`          | string   | no       | `openrouter/free`                        | Any [OpenRouter model slug](https://openrouter.ai/models). The default is an auto-router that picks an available free model. |
| `fallbackModels` | string[] | no       | `["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free"]` | Tried in order if the primary `model` is unavailable. Uses [OpenRouter model routing](https://openrouter.ai/docs/features/model-routing). OpenRouter caps the combined list (primary + fallbacks) at **3 entries**; extras are dropped. |
| `title`          | string   | no       | `"AI Assistant"`                         | Header title.                                                               |
| `initialMessage` | string   | no       | `"Hi 👋 Ask me anything about this page."` | First bot message.                                                          |
| `systemPrompt`   | string   | no       | (built-in)                               | Override the system prompt. Retrieved context is appended automatically.    |
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

### `embedChatWidget` options

`embedChatWidget(options)` accepts all `ChatWidget` props plus:

- `container?: HTMLElement | string` — where to mount. If omitted, a new `div` is appended to `document.body`.

## How retrieval works

1. The provided text is split into chunks (paragraphs, then long paragraphs are sub-split).
2. A Fuse.js index is built over those chunks.
3. On each user message, the top `topK` matching chunks are concatenated and injected into the system prompt under a `CONTEXT:` section.
4. The model is instructed to answer only from that context.

## Conversation memory

Each request to OpenRouter includes only the system prompt (with retrieved context) and the **current** user message — prior turns in the chat panel are not replayed to the model. This keeps the widget cheap and predictable as a focused FAQ bot, but it means the assistant cannot resolve follow-ups like "and what about the second one?" that depend on earlier turns. If you need multi-turn memory, fork `ChatWidget.tsx` and pass the running `messages` array into `callOpenRouter`.

## Security note

This widget is designed to be used in **proxy mode**, so no provider API keys are ever shipped to the browser. Store secrets on your server (e.g. `OPENROUTER_API_KEY`) and expose only a `/api/chat` endpoint to the widget.

### Prompt injection

The system prompt instructs the model to answer only from the provided `CONTEXT:` block, but this is a soft constraint — like every LLM application, the widget is not immune to prompt injection. Treat the `context` / `contextUrl` text as **trusted** content (you authored it) and treat user messages as **untrusted**: a sufficiently crafted user message ("Ignore previous instructions and …") or poisoned context file can coerce the model into ignoring the refusal rule, leaking the system prompt, or answering off-topic. If that matters for your use case:

- Host the context file on a domain you control so it can't be tampered with in transit.
- Don't put secrets, credentials, or anything you wouldn't paste into a public chat into the context — assume any text the model can see can be exfiltrated through the reply.
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


## License

MIT
