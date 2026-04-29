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

## Usage

Provide either a `context` string or a `contextUrl` pointing to a `.txt` file:

```tsx
import { ChatWidget } from "@surihoney/chatbot-widget";

export default function App() {
    return (
        <ChatWidget
            apiKey={import.meta.env.VITE_OPENROUTER_API_KEY}
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

Or pass the context inline:

```tsx
<ChatWidget
    apiKey={import.meta.env.VITE_OPENROUTER_API_KEY}
    context={`Sue is a frontend engineer based in...

Projects:
- Project A: ...
- Project B: ...`}
/>
```

## Props

| Prop             | Type     | Required | Default                                  | Description                                                                 |
| ---------------- | -------- | -------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| `apiKey`         | string   | yes      | —                                        | OpenRouter API key. **Exposed in browser** — see security note.             |
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

## How retrieval works

1. The provided text is split into chunks (paragraphs, then long paragraphs are sub-split).
2. A Fuse.js index is built over those chunks.
3. On each user message, the top `topK` matching chunks are concatenated and injected into the system prompt under a `CONTEXT:` section.
4. The model is instructed to answer only from that context.

## Conversation memory

Each request to OpenRouter includes only the system prompt (with retrieved context) and the **current** user message — prior turns in the chat panel are not replayed to the model. This keeps the widget cheap and predictable as a focused FAQ bot, but it means the assistant cannot resolve follow-ups like "and what about the second one?" that depend on earlier turns. If you need multi-turn memory, fork `ChatWidget.tsx` and pass the running `messages` array into `callOpenRouter`.

## Security note

OpenRouter API keys passed to the widget are sent directly from the browser. Anyone visiting the site can read the key from the network tab. Mitigations:

- Use a key with strict spend / rate limits, **or**
- Run a tiny proxy on your own backend and adapt this widget to call your endpoint instead of OpenRouter directly. (The `openRouter.ts` module is a single function — easy to swap.)

### Prompt injection

The system prompt instructs the model to answer only from the provided `CONTEXT:` block, but this is a soft constraint — like every LLM application, the widget is not immune to prompt injection. Treat the `context` / `contextUrl` text as **trusted** content (you authored it) and treat user messages as **untrusted**: a sufficiently crafted user message ("Ignore previous instructions and …") or poisoned context file can coerce the model into ignoring the refusal rule, leaking the system prompt, or answering off-topic. If that matters for your use case:

- Host the context file on a domain you control so it can't be tampered with in transit.
- Don't put secrets, credentials, or anything you wouldn't paste into a public chat into the context — assume any text the model can see can be exfiltrated through the reply.
- Add an output filter / moderation step on a backend proxy if you need stronger guarantees than a system prompt can give.

## Develop

This project ships with a small Vite playground in `examples/` that imports the widget directly from `src/`, so changes hot-reload as you work.

```bash
npm install
cp .env.example .env.local      # then fill in VITE_OPENROUTER_API_KEY
npm run dev
npm run buildy
```

The playground (`examples/App.tsx`) demonstrates both context modes:

- An inline `context` string.
- Fetching `public/sample-context.txt` via `contextUrl`.


## License

MIT
