import { afterEach, describe, expect, it, vi } from "vitest";
import {
    callOpenRouter,
    consumeOpenAIChatCompletionStream,
    streamOpenRouter
} from "./openRouter";

function sseResponse(lines: string[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            for (const line of lines) {
                controller.enqueue(encoder.encode(line));
            }
            controller.close();
        }
    });
    return new Response(stream, {
        headers: { "Content-Type": "text/event-stream" }
    });
}

describe("consumeOpenAIChatCompletionStream", () => {
    it("invokes onDelta for each streamed token", async () => {
        const res = sseResponse([
            'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
            'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
            "data: [DONE]\n"
        ]);
        const deltas: string[] = [];
        await consumeOpenAIChatCompletionStream(res, chunk => deltas.push(chunk));
        expect(deltas).toEqual(["Hel", "lo"]);
    });

    it("throws when the response has no body", async () => {
        const res = new Response(null);
        await expect(
            consumeOpenAIChatCompletionStream(res, () => {})
        ).rejects.toThrow("Response has no readable body.");
    });
});

describe("callOpenRouter", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns trimmed assistant content on success", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        choices: [{ message: { content: "  Hi there  " } }]
                    }),
                    { status: 200 }
                )
            )
        );

        const reply = await callOpenRouter({
            apiKey: "test-key",
            model: "openrouter/free",
            messages: [{ role: "user", content: "Hello" }]
        });

        expect(reply).toBe("Hi there");
    });

    it("throws with status details when the request fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response("rate limited", { status: 429 })
            )
        );

        await expect(
            callOpenRouter({
                apiKey: "test-key",
                model: "openrouter/free",
                messages: [{ role: "user", content: "Hello" }]
            })
        ).rejects.toThrow("OpenRouter request failed (429)");
    });

    it("deduplicates fallback models in the request body", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    choices: [{ message: { content: "ok" } }]
                }),
                { status: 200 }
            )
        );
        vi.stubGlobal("fetch", fetchMock);

        await callOpenRouter({
            apiKey: "test-key",
            model: "primary",
            fallbackModels: ["primary", "fallback-a", "fallback-b"],
            messages: [{ role: "user", content: "Hello" }]
        });

        const body = JSON.parse(
            (fetchMock.mock.calls[0][1] as RequestInit).body as string
        );
        expect(body.models).toEqual(["primary", "fallback-a", "fallback-b"]);
        expect(body.stream).toBe(false);
    });
});

describe("streamOpenRouter", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("streams deltas from OpenRouter SSE responses", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                sseResponse([
                    'data: {"choices":[{"delta":{"content":"A"}}]}\n',
                    'data: {"choices":[{"delta":{"content":"B"}}]}\n',
                    "data: [DONE]\n"
                ])
            )
        );

        const deltas: string[] = [];
        await streamOpenRouter({
            apiKey: "test-key",
            model: "openrouter/free",
            messages: [{ role: "user", content: "Hello" }],
            onDelta: chunk => deltas.push(chunk)
        });

        expect(deltas).toEqual(["A", "B"]);
    });
});
