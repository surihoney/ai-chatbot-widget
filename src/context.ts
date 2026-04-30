/**
 * Splits raw text into retrievable chunks.
 *
 * Strategy: split on blank lines (paragraphs) first. If any chunk is
 * still very long, fall back to splitting that chunk on single newlines
 * so Fuse.js has reasonably sized units to score.
 */
export function chunkText(raw: string, maxChunkLength = 600): string[] {
    if (!raw) return [];

    const hardWrapIntoChunks = (text: string) => {
        const t = text.trim();
        if (!t) return;
        if (t.length <= maxChunkLength) {
            chunks.push(t);
            return;
        }
        for (let i = 0; i < t.length; i += maxChunkLength) {
            chunks.push(t.slice(i, i + maxChunkLength));
        }
    };

    const paragraphs = raw
        .replace(/\r\n/g, "\n")
        .split(/\n\s*\n+/)
        .map(p => p.trim())
        .filter(Boolean);

    const chunks: string[] = [];
    for (const p of paragraphs) {
        if (p.length <= maxChunkLength) {
            chunks.push(p);
            continue;
        }
        const lines = p
            .split(/\n+/)
            .map(l => l.trim())
            .filter(Boolean);

        let buffer = "";
        for (const line of lines) {
            if (line.length > maxChunkLength) {
                if (buffer) {
                    chunks.push(buffer.trim());
                    buffer = "";
                }
                hardWrapIntoChunks(line);
                continue;
            }
            if ((buffer + " " + line).trim().length > maxChunkLength) {
                if (buffer) chunks.push(buffer.trim());
                buffer = line;
            } else {
                buffer = buffer ? `${buffer} ${line}` : line;
            }
        }
        if (buffer) chunks.push(buffer.trim());
    }
    return chunks;
}
