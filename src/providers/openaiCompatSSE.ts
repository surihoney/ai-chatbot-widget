/**
 * Reads an OpenAI-compatible chat completion SSE stream (`text/event-stream`)
 * and invokes `onDelta` for each text token chunk.
 */
export async function consumeOpenAIChatCompletionStream(
    response: Response,
    onDelta: (chunk: string) => void,
    signal?: AbortSignal
): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response has no readable body.");

    const decoder = new TextDecoder();
    let carry = "";

    try {
        while (true) {
            if (signal?.aborted) {
                await reader.cancel();
                throw new DOMException("Aborted", "AbortError");
            }
            const { done, value } = await reader.read();
            if (done) break;

            carry += decoder.decode(value, { stream: true });
            const lines = carry.split("\n");
            carry = lines.pop() ?? "";

            for (const line of lines) {
                const trimmed = line.replace(/\r$/, "").trimEnd();
                if (!trimmed || trimmed.startsWith(":")) continue;
                if (!trimmed.startsWith("data:")) continue;
                const data = trimmed.slice(5).trimStart();
                if (data === "[DONE]") return;

                try {
                    const json = JSON.parse(data) as {
                        choices?: Array<{
                            delta?: { content?: string | null };
                        }>;
                    };
                    const piece = json?.choices?.[0]?.delta?.content;
                    if (typeof piece === "string" && piece.length > 0) {
                        onDelta(piece);
                    }
                } catch {
                    // Ignore non-JSON SSE lines (e.g. heartbeats).
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export function formatOpenAIChatCompletionSSEChunk(chunk: string): string {
    return `data: ${JSON.stringify({
        choices: [{ delta: { content: chunk } }]
    })}\n\n`;
}

export const OPENAI_CHAT_COMPLETION_SSE_DONE = "data: [DONE]\n\n";

/**
 * Runs `provider.stream` and re-emits tokens as OpenAI-compatible SSE.
 */
export function openAIChatCompletionSSEStream(
    stream: (
        onDelta: (chunk: string) => void
    ) => Promise<void>
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
        async start(controller) {
            try {
                await stream(chunk => {
                    controller.enqueue(
                        encoder.encode(formatOpenAIChatCompletionSSEChunk(chunk))
                    );
                });
                controller.enqueue(
                    encoder.encode(OPENAI_CHAT_COMPLETION_SSE_DONE)
                );
                controller.close();
            } catch (err) {
                controller.error(err);
            }
        }
    });
}
