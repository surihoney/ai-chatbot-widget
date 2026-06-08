import { describe, expect, it } from "vitest";
import { isSameOriginUrl, sanitizeChatText } from "./security";

describe("sanitizeChatText", () => {
    it("returns strings unchanged when within limits", () => {
        expect(sanitizeChatText("Hello, world!")).toBe("Hello, world!");
    });

    it("coerces non-string input", () => {
        expect(sanitizeChatText(42)).toBe("42");
        expect(sanitizeChatText(null)).toBe("");
    });

    it("truncates to maxLen", () => {
        expect(sanitizeChatText("abcdef", { maxLen: 3 })).toBe("abc");
    });

    it("strips bidi and invisible unicode controls", () => {
        const withRtl = "hello\u202Eworld";
        expect(sanitizeChatText(withRtl)).toBe("helloworld");
    });

    it("strips control chars but keeps newline and tab", () => {
        expect(sanitizeChatText("a\u0001b\nc\td")).toBe("ab\nc\td");
    });
});

describe("isSameOriginUrl", () => {
    it("returns true for same-origin relative paths", () => {
        expect(isSameOriginUrl("/api/chat")).toBe(true);
    });

    it("returns false for cross-origin absolute URLs", () => {
        expect(isSameOriginUrl("https://evil.example/api")).toBe(false);
    });

    it("returns false for clearly cross-origin absolute URLs", () => {
        expect(isSameOriginUrl("http://other-host.example/path")).toBe(false);
    });
});
