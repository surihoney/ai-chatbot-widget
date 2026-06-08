import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proactiveDelayToMs, useProactiveChat } from "./useProactiveChat";

describe("proactiveDelayToMs", () => {
    it("converts seconds to milliseconds", () => {
        expect(proactiveDelayToMs(30, "seconds")).toBe(30_000);
    });

    it("converts minutes to milliseconds", () => {
        expect(proactiveDelayToMs(2, "minutes")).toBe(120_000);
    });

    it("clamps negative delays to zero", () => {
        expect(proactiveDelayToMs(-5, "seconds")).toBe(0);
    });
});

describe("useProactiveChat", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not trigger when disabled", () => {
        const onTrigger = vi.fn();
        renderHook(() =>
            useProactiveChat({
                enabled: false,
                delayMs: 1000,
                onTrigger
            })
        );

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(onTrigger).not.toHaveBeenCalled();
    });

    it("fires onTrigger after the idle delay", () => {
        const onTrigger = vi.fn();
        renderHook(() =>
            useProactiveChat({
                enabled: true,
                delayMs: 1000,
                oncePerSession: false,
                onTrigger
            })
        );

        act(() => {
            vi.advanceTimersByTime(999);
        });
        expect(onTrigger).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(onTrigger).toHaveBeenCalledOnce();
    });

    it("fires only once per session by default", () => {
        const onTrigger = vi.fn();
        const { unmount } = renderHook(() =>
            useProactiveChat({
                enabled: true,
                delayMs: 500,
                onTrigger
            })
        );

        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(onTrigger).toHaveBeenCalledOnce();

        unmount();
        renderHook(() =>
            useProactiveChat({
                enabled: true,
                delayMs: 500,
                onTrigger
            })
        );

        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(onTrigger).toHaveBeenCalledOnce();
    });

    it("does not fire while paused", () => {
        const onTrigger = vi.fn();
        renderHook(() =>
            useProactiveChat({
                enabled: true,
                delayMs: 1000,
                oncePerSession: false,
                paused: true,
                onTrigger
            })
        );

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(onTrigger).not.toHaveBeenCalled();
    });
});
