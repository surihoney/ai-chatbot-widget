# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.1] - 2026-08-30

Patch for the 2.4.0 npm tarball. No public API changes.

### Fixed

- Widget and server entries now build as self-contained files. 2.4.0 emitted a shared hashed chunk (`openrouter-XXXX.js`) that was omitted from the published package, which caused Next.js/Vercel builds to fail with `Can't resolve './openrouter-….js'`.
- `files` now ships the entire `dist/` directory so any future chunks are included in the npm tarball.

## [2.4.0] - 2026-08-29

Compared to **2.3.1**. Minor release: existing 2.3.x setups keep working with no code changes.

### Compatibility

Not a breaking change for public APIs:

- `<ChatWidget />` / `embedChatWidget` props are unchanged (`transport="auto" | "openrouter" | "proxy"`, `apiKey`, `proxyUrl`, `stream`, OpenRouter extras).
- `handleChatProxyRequest(req, { apiKey })` still defaults to OpenRouter and `OPENROUTER_API_KEY`.
- Root package exports (`ChatWidget`, `embedChatWidget`, widget types) are unchanged.

`callOpenRouter` / `streamOpenRouter` remain in `src/openRouter.ts` as wrappers; they were never part of the published package entry.

### Added

- Internal `complete` / `stream` contract (`AIProvider`, `ChatTransport`) so the widget does not call a vendor client directly.
- Optional `transport="direct"` as an alias of `"openrouter"` (still OpenRouter today).
- `handleChatProxyRequest` accepts an optional `provider` instead of always calling OpenRouter.
- Server entry re-exports `createOpenRouterProvider` and types `AIProvider`, `ChatCompletionRequest`, `LLMMessage`.

### Changed

- Chat requests go through a transport layer (`proxy` vs `direct`) with OpenRouter as the default provider adapter.
- Proxy streaming responses are emitted as canonical OpenAI-compatible SSE (same shape the widget already parses).
- README: multi-turn fork note now refers to the transport `complete` / `stream` request.
