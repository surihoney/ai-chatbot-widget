import { afterEach, describe, expect, it, vi } from "vitest";
import { handleChatProxyRequest } from "./server";

function postRequest(
    body: unknown,
    init?: { origin?: string; contentLength?: string }
): Request {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    if (init?.origin) headers.Origin = init.origin;
    if (init?.contentLength) headers["Content-Length"] = init.contentLength;

    return new Request("https://example.com/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    });
}

describe("handleChatProxyRequest", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("responds to OPTIONS with CORS preflight headers", async () => {
        const res = await handleChatProxyRequest(
            new Request("https://example.com/api/chat", { method: "OPTIONS" }),
            { apiKey: "key" }
        );
        expect(res.status).toBe(204);
        expect(res.headers.get("Access-Control-Allow-Methods")).toContain(
            "POST"
        );
    });

    it("rejects non-POST methods", async () => {
        const res = await handleChatProxyRequest(
            new Request("https://example.com/api/chat", { method: "GET" }),
            { apiKey: "key" }
        );
        expect(res.status).toBe(405);
    });

    it("returns 500 when no API key is configured", async () => {
        const res = await handleChatProxyRequest(
            postRequest({
                model: "openrouter/free",
                messages: [{ role: "user", content: "Hi" }]
            })
        );
        expect(res.status).toBe(500);
        expect(await res.text()).toContain("missing OpenRouter API key");
    });

    it("rejects disallowed origins", async () => {
        const res = await handleChatProxyRequest(
            postRequest(
                {
                    model: "openrouter/free",
                    messages: [{ role: "user", content: "Hi" }]
                },
                { origin: "https://evil.example" }
            ),
            { apiKey: "key", allowedOrigins: ["https://app.example"] }
        );
        expect(res.status).toBe(403);
    });

    it("validates required fields", async () => {
        const missingModel = await handleChatProxyRequest(
            postRequest({ model: "", messages: [{ role: "user", content: "Hi" }] }),
            { apiKey: "key" }
        );
        expect(missingModel.status).toBe(400);

        const missingMessages = await handleChatProxyRequest(
            postRequest({ model: "openrouter/free", messages: [] }),
            { apiKey: "key" }
        );
        expect(missingMessages.status).toBe(400);
    });

    it("returns JSON reply from OpenRouter on success", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        choices: [{ message: { content: "Hello from bot" } }]
                    }),
                    { status: 200 }
                )
            )
        );

        const res = await handleChatProxyRequest(
            postRequest({
                model: "openrouter/free",
                messages: [{ role: "user", content: "Hi" }]
            }),
            { apiKey: "key" }
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ reply: "Hello from bot" });
    });

    it("pipes SSE when stream is requested", async () => {
        const encoder = new TextEncoder();
        const upstream = new ReadableStream({
            start(controller) {
                controller.enqueue(
                    encoder.encode(
                        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n'
                    )
                );
                controller.close();
            }
        });

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(upstream, {
                    status: 200,
                    headers: { "Content-Type": "text/event-stream" }
                })
            )
        );

        const res = await handleChatProxyRequest(
            postRequest(
                {
                    model: "openrouter/free",
                    messages: [{ role: "user", content: "Hi" }],
                    stream: true
                },
                { origin: "https://app.example" }
            ),
            { apiKey: "key", allowedOrigins: ["https://app.example"] }
        );

        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/event-stream");
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
            "https://app.example"
        );
        expect(await res.text()).toContain('"content":"Hi"');
    });

    it("uses an injected provider without an API key", async () => {
        const complete = vi.fn().mockResolvedValue("mock reply");
        const res = await handleChatProxyRequest(
            postRequest({
                model: "openrouter/free",
                messages: [{ role: "user", content: "Hi" }]
            }),
            {
                provider: {
                    id: "mock",
                    complete,
                    stream: vi.fn()
                }
            }
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ reply: "mock reply" });
        expect(complete).toHaveBeenCalledTimes(1);
        expect(complete.mock.calls[0][0].messages).toEqual([
            { role: "user", content: "Hi" }
        ]);
    });

    it("rejects oversized bodies", async () => {
        const res = await handleChatProxyRequest(
            new Request("https://example.com/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": "999999"
                },
                body: "{}"
            }),
            { apiKey: "key", maxBodyBytes: 1024 }
        );
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/too large/i);
    });
});
