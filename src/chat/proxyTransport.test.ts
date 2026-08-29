import { afterEach, describe, expect, it, vi } from "vitest";
import { createProxyTransport } from "./proxyTransport";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

const baseReq = {
    model: "openrouter/free",
    messages: [{ role: "user" as const, content: "Hello" }],
    extras: {
        fallbackModels: ["fallback-a"],
        siteUrl: "https://site.example",
        siteName: "Site"
    }
};

describe("createProxyTransport", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("complete() returns { reply } from JSON", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse({ reply: "  Hi  " }))
        );
        const transport = createProxyTransport({ proxyUrl: "/api/chat" });
        await expect(transport.complete(baseReq)).resolves.toBe("Hi");
    });

    it("complete() accepts OpenRouter-shaped JSON", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonResponse({
                    choices: [{ message: { content: "From choices" } }]
                })
            )
        );
        const transport = createProxyTransport({ proxyUrl: "/api/chat" });
        await expect(transport.complete(baseReq)).resolves.toBe("From choices");
    });

    it("complete() returns plain text when the response is not JSON", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("plain reply", { status: 200 }))
        );
        const transport = createProxyTransport({ proxyUrl: "/api/chat" });
        await expect(transport.complete(baseReq)).resolves.toBe("plain reply");
    });

    it("complete() throws on HTTP errors", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("nope", { status: 502 }))
        );
        const transport = createProxyTransport({ proxyUrl: "/api/chat" });
        await expect(transport.complete(baseReq)).rejects.toThrow(
            "Proxy request failed (502)"
        );
    });

    it("stream() POSTs stream: true and forwards SSE deltas", async () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream({
            start(controller) {
                controller.enqueue(
                    encoder.encode(
                        'data: {"choices":[{"delta":{"content":"A"}}]}\n'
                    )
                );
                controller.enqueue(
                    encoder.encode(
                        'data: {"choices":[{"delta":{"content":"B"}}]}\n'
                    )
                );
                controller.enqueue(encoder.encode("data: [DONE]\n"));
                controller.close();
            }
        });
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(body, {
                status: 200,
                headers: { "Content-Type": "text/event-stream" }
            })
        );
        vi.stubGlobal("fetch", fetchMock);

        const deltas: string[] = [];
        const transport = createProxyTransport({
            proxyUrl: "/api/chat",
            proxyHeaders: { "X-CSRF": "tok" }
        });
        await transport.stream(baseReq, chunk => deltas.push(chunk));

        expect(deltas).toEqual(["A", "B"]);
        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect((init.headers as Record<string, string>)["X-CSRF"]).toBe("tok");
        expect(JSON.parse(init.body as string).stream).toBe(true);
    });

    it("stream() treats a JSON body as a single delta", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse({ reply: "all at once" }))
        );
        const deltas: string[] = [];
        const transport = createProxyTransport({ proxyUrl: "/api/chat" });
        await transport.stream(baseReq, chunk => deltas.push(chunk));
        expect(deltas).toEqual(["all at once"]);
    });
});
