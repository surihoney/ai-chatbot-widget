import { createOpenRouterProvider } from "../providers/openrouter";
import { isSameOriginUrl } from "../security";
import { createDirectTransport } from "./directTransport";
import { createProxyTransport } from "./proxyTransport";
import type { ChatTransport } from "./types";

export type ResolveTransportInput = {
    transport?: "auto" | "openrouter" | "proxy" | "direct";
    apiKey?: string;
    proxyUrl?: string;
    proxyHeaders?: Record<string, string>;
    allowCrossOriginProxyUrl?: boolean;
};

export type ResolveTransportResult =
    | { ok: true; transport: ChatTransport }
    | { ok: false; error: string };

export function resolveTransport(
    input: ResolveTransportInput
): ResolveTransportResult {
    const kind: "direct" | "proxy" | null =
        input.transport === "openrouter" || input.transport === "direct"
            ? "direct"
            : input.transport === "proxy"
              ? "proxy"
              : input.apiKey
                ? "direct"
                : input.proxyUrl
                  ? "proxy"
                  : null;

    if (kind === "direct" && !input.apiKey) {
        return {
            ok: false,
            error: 'Missing OpenRouter API key. Either pass `apiKey` or switch to proxy mode (e.g. `transport="proxy"` + `proxyUrl`).'
        };
    }

    if (kind === null) {
        return {
            ok: false,
            error: "Widget is not configured. Provide `apiKey` (OpenRouter) or `proxyUrl` (proxy)."
        };
    }

    if (kind === "direct") {
        return {
            ok: true,
            transport: createDirectTransport(
                createOpenRouterProvider({ apiKey: input.apiKey as string })
            )
        };
    }

    const proxyUrl = input.proxyUrl ?? "/api/chat";
    if (!input.allowCrossOriginProxyUrl && !isSameOriginUrl(proxyUrl)) {
        return {
            ok: false,
            error: "For safety, this widget only sends chat content to a same-origin `proxyUrl`. If you intended to use a cross-origin proxy, pass `allowCrossOriginProxyUrl={true}`."
        };
    }

    return {
        ok: true,
        transport: createProxyTransport({
            proxyUrl,
            proxyHeaders: input.proxyHeaders
        })
    };
}
