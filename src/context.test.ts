import { describe, expect, it } from "vitest";
import { chunkText } from "./context";

describe("chunkText", () => {
    it("returns empty array for empty input", () => {
        expect(chunkText("")).toEqual([]);
        expect(chunkText("   ")).toEqual([]);
    });

    it("splits paragraphs on blank lines", () => {
        const raw = "First paragraph.\n\nSecond paragraph.";
        expect(chunkText(raw)).toEqual([
            "First paragraph.",
            "Second paragraph."
        ]);
    });

    it("normalizes CRLF line endings", () => {
        expect(chunkText("Line one\r\n\r\nLine two")).toEqual([
            "Line one",
            "Line two"
        ]);
    });

    it("wraps very long single lines into fixed-size chunks", () => {
        const longLine = "x".repeat(1500);
        const chunks = chunkText(longLine, 400);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.every(c => c.length <= 400)).toBe(true);
        expect(chunks.join("")).toBe(longLine);
    });

    it("combines short lines within a long paragraph up to maxChunkLength", () => {
        const line = "word ".repeat(30).trim();
        const raw = `${line}\n${line}\n${line}`;
        const chunks = chunkText(raw, 200);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.every(c => c.length <= 200)).toBe(true);
    });
});
