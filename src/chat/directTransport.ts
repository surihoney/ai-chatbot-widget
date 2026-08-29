import type { AIProvider, ChatTransport } from "./types";

export function createDirectTransport(provider: AIProvider): ChatTransport {
    return {
        complete: req => provider.complete(req),
        stream: (req, onDelta) => provider.stream(req, onDelta)
    };
}
