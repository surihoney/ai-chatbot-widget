/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["src/test/setup.ts"],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        globals: false
    },
    plugins: [react()],
    publicDir: false
});
