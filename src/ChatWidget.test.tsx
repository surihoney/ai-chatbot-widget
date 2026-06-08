import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ChatWidget from "./ChatWidget";

describe("ChatWidget", () => {
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
});
