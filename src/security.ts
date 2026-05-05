const DEFAULT_MAX_LEN = 8000;
const BIDI_AND_INVISIBLE =
    /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g; // UI-spoofing controls
const OTHER_CONTROLS_EXCEPT_NEWLINE_TAB =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Sanitize untrusted text for safe display + prompt inclusion.
 *
 * Notes:
 * - React text nodes are already HTML-escaped, but stripping invisible/bidi controls
 *   prevents UI spoofing (e.g. RTL override) and makes logs/prompts more predictable.
 * - This is NOT a substitute for server-side validation/security controls.
 */
export function sanitizeChatText(
    input: unknown,
    opts?: { maxLen?: number }
): string {
    const maxLen = opts?.maxLen ?? DEFAULT_MAX_LEN;
    const s = typeof input === "string" ? input : String(input ?? "");
    const trimmed = s.length > maxLen ? s.slice(0, maxLen) : s;
    return trimmed
        .replace(BIDI_AND_INVISIBLE, "")
        .replace(OTHER_CONTROLS_EXCEPT_NEWLINE_TAB, "");
}

export function isSameOriginUrl(url: string): boolean {
    try {
        const resolved = new URL(url, window.location.href);
        return resolved.origin === window.location.origin;
    } catch {
        return false;
    }
}

