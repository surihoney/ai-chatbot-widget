'use client'
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import ChatWidget from "./ChatWidget";
import type {
    ChatWidgetProps,
    EmbedChatWidgetHandle,
    EmbedChatWidgetOptions
} from "./types";

function resolveContainer(
    container: EmbedChatWidgetOptions["container"]
): { el: HTMLElement; owns: boolean } {
    if (container === undefined) {
        const el = document.createElement("div");
        el.setAttribute("data-surihoney-chatbot-root", "");
        document.body.appendChild(el);
        return { el, owns: true };
    }
    if (typeof container === "string") {
        const found = document.querySelector(container);
        if (!(found instanceof HTMLElement)) {
            throw new Error(
                `embedChatWidget: selector "${container}" did not match an HTMLElement.`
            );
        }
        return { el: found, owns: false };
    }
    return { el: container, owns: false };
}

/**
 * Mounts the chat widget outside of React (e.g. from a plain script or legacy app).
 * Requires `react` and `react-dom` in the host app.
 */
export function embedChatWidget(
    options: EmbedChatWidgetOptions
): EmbedChatWidgetHandle {
    if (typeof document === "undefined") {
        throw new Error("embedChatWidget must be called in a browser environment.");
    }

    const { container: containerOpt, ...widgetProps } = options;
    const { el, owns } = resolveContainer(containerOpt);
    const root: Root = createRoot(el);

    let currentProps: ChatWidgetProps = widgetProps;

    const render = () => {
        root.render(
            <StrictMode>
                <ChatWidget {...currentProps} />
            </StrictMode>
        );
    };

    render();

    return {
        unmount: () => {
            root.unmount();
            if (owns && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        },
        update: (partial: Partial<ChatWidgetProps>) => {
            currentProps = { ...currentProps, ...partial };
            render();
        }
    };
}
