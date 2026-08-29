import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTransport } from "./chat/resolveTransport";
import ChatWidget from "./ChatWidget";

vi.mock("./chat/resolveTransport", () => ({
    resolveTransport: vi.fn()
}));

describe("ChatWidget", () => {
    afterEach(() => {
        vi.mocked(resolveTransport).mockReset();
    });

    it("sends system + user messages through the chat transport", async () => {
        const complete = vi.fn().mockResolvedValue("We are open 9 to 5.");
        vi.mocked(resolveTransport).mockReturnValue({
            ok: true,
            transport: { complete, stream: vi.fn() }
        });

        const user = userEvent.setup();
        render(
            <ChatWidget
                context="Our hours are 9am to 5pm."
                title="Support Bot"
                initialMessage="How can I help?"
                stream={false}
            />
        );

        await user.click(screen.getByRole("button", { name: "Chat" }));
        await user.type(
            screen.getByPlaceholderText("Ask something..."),
            "What are your hours?"
        );
        await user.click(screen.getByRole("button", { name: "Send" }));

        expect(complete).toHaveBeenCalledTimes(1);
        const req = complete.mock.calls[0][0];
        expect(req.messages).toEqual([
            expect.objectContaining({ role: "system" }),
            { role: "user", content: "What are your hours?" }
        ]);
        expect(req.messages[0].content).toContain("CONTEXT:");
        expect(
            await screen.findByText("We are open 9 to 5.")
        ).toBeInTheDocument();
    });

    it("renders the launcher button", () => {
        render(
            <ChatWidget
                context="Our hours are 9am to 5pm."
                title="Support Bot"
                initialMessage="How can I help?"
            />
        );

        expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    });

    it("opens the panel and shows title, messages, and input", async () => {
        const user = userEvent.setup();

        render(
            <ChatWidget
                context="FAQ content"
                title="Help"
                initialMessage="Hello"
            />
        );

        await user.click(screen.getByRole("button", { name: "Chat" }));

        expect(screen.getByRole("dialog", { name: "Help" })).toBeInTheDocument();
        expect(screen.getByText("Hello")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Ask something...")).toBeInTheDocument();
    });

    it("replaces the initial greeting when opening from the proactive bubble", () => {
        vi.useFakeTimers();

        try {
            sessionStorage.clear();
            render(
                <ChatWidget
                    context="FAQ content"
                    title="Help"
                    initialMessage="Hi! Ask anything about me."
                    proactive
                    proactiveDelay={1}
                    proactiveOncePerSession={false}
                    proactiveMessage="Hi! Ask anything about me."
                />
            );

            act(() => {
                vi.advanceTimersByTime(1_000);
            });

            const proactiveBubble = screen.getByRole("button", {
                name: "Hi! Ask anything about me. — Chat"
            });
            fireEvent.click(proactiveBubble);

            expect(screen.getByRole("dialog", { name: "Help" })).toBeInTheDocument();
            expect(screen.getAllByText("Hi! Ask anything about me.")).toHaveLength(1);
        } finally {
            vi.useRealTimers();
            sessionStorage.clear();
        }
    });
});
