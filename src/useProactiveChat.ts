import { useEffect, useRef } from "react";

const PROACTIVE_SESSION_KEY = "surihoney-chatbot-proactive-shown";

/** Intentional page activity — omit mousemove so minor pointer drift does not reset idle. */
const IDLE_EVENTS = [
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
    "click"
] as const;

export function proactiveDelayToMs(
    delay: number,
    unit: "seconds" | "minutes"
): number {
    const ms = unit === "minutes" ? delay * 60_000 : delay * 1_000;
    return Math.max(0, ms);
}

export function useProactiveChat({
    enabled,
    delayMs,
    oncePerSession = true,
    paused = false,
    onTrigger
}: {
    enabled: boolean;
    delayMs: number;
    oncePerSession?: boolean;
    paused?: boolean;
    onTrigger: () => void;
}): void {
    const firedRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onTriggerRef = useRef(onTrigger);
    const pausedRef = useRef(paused);

    onTriggerRef.current = onTrigger;
    pausedRef.current = paused;

    const clearTimer = () => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const hasSessionFired = () => {
        if (!oncePerSession) return false;
        try {
            return sessionStorage.getItem(PROACTIVE_SESSION_KEY) === "1";
        } catch {
            return false;
        }
    };

    const markFired = () => {
        firedRef.current = true;
        if (oncePerSession) {
            try {
                sessionStorage.setItem(PROACTIVE_SESSION_KEY, "1");
            } catch {
                // sessionStorage may be unavailable (private mode, etc.)
            }
        }
    };

    useEffect(() => {
        if (!enabled) return;

        if (hasSessionFired()) {
            firedRef.current = true;
            return;
        }

        const scheduleTimer = () => {
            clearTimer();
            if (firedRef.current || hasSessionFired() || pausedRef.current) {
                return;
            }
            timerRef.current = setTimeout(() => {
                if (firedRef.current || hasSessionFired() || pausedRef.current) {
                    return;
                }
                markFired();
                onTriggerRef.current();
            }, delayMs);
        };

        const resetIdle = () => {
            if (firedRef.current || hasSessionFired() || pausedRef.current) {
                return;
            }
            scheduleTimer();
        };

        if (!pausedRef.current) {
            scheduleTimer();
        }

        for (const ev of IDLE_EVENTS) {
            window.addEventListener(ev, resetIdle, { passive: true });
        }

        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                clearTimer();
            } else if (!pausedRef.current) {
                scheduleTimer();
            }
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            clearTimer();
            for (const ev of IDLE_EVENTS) {
                window.removeEventListener(ev, resetIdle);
            }
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [enabled, delayMs, oncePerSession, paused]);
}
