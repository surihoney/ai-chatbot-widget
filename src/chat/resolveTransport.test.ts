import { describe, expect, it } from "vitest";
import { resolveTransport } from "./resolveTransport";

describe("resolveTransport", () => {
    it("uses a direct OpenRouter transport when apiKey is set (auto)", () => {
        const result = resolveTransport({ apiKey: "sk-test" });
        expect(result.ok).toBe(true);
    });

    it("treats transport=openrouter and transport=direct as the same", () => {
        const openrouter = resolveTransport({
            transport: "openrouter",
            apiKey: "sk-test"
        });
        const direct = resolveTransport({
            transport: "direct",
            apiKey: "sk-test"
        });
        expect(openrouter.ok).toBe(true);
        expect(direct.ok).toBe(true);
    });

    it("returns the missing-key error for direct mode without apiKey", () => {
        const result = resolveTransport({ transport: "openrouter" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatch(/Missing OpenRouter API key/);
        }
    });

    it("returns not-configured when auto has neither apiKey nor proxyUrl", () => {
        const result = resolveTransport({ transport: "auto" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatch(/not configured/);
        }
    });

    it("uses proxy for same-origin proxyUrl", () => {
        const result = resolveTransport({
            transport: "proxy",
            proxyUrl: "/api/chat"
        });
        expect(result.ok).toBe(true);
    });

    it("blocks cross-origin proxyUrl unless allowCrossOriginProxyUrl is set", () => {
        const blocked = resolveTransport({
            transport: "proxy",
            proxyUrl: "https://evil.example/api/chat"
        });
        expect(blocked.ok).toBe(false);
        if (!blocked.ok) {
            expect(blocked.error).toMatch(/same-origin/);
        }

        const allowed = resolveTransport({
            transport: "proxy",
            proxyUrl: "https://evil.example/api/chat",
            allowCrossOriginProxyUrl: true
        });
        expect(allowed.ok).toBe(true);
    });
});
