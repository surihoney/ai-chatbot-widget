import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [
        react(),
        dts({
            include: ["src"],
        })
    ],
    publicDir: false,
    build: {
        lib: {
            entry: {
                index: "src/index.ts",
                server: "src/server.ts"
            },
            formats: ["es"],
            name: "ChatWidget",
            fileName: (_format, entryName) =>
                entryName === "server" ? "server.js" : "index.js"
        },
        rollupOptions: {
            output: {
                // Vite lib build drops `'use client'` from the entry; Next needs it on the emitted file.
                banner: chunk => (chunk.name === "index" ? '"use client";' : ""),
            },
            external: [
                "react",
                "react/jsx-runtime",
                "react/jsx-dev-runtime",
                "react-dom",
                "react-dom/client"
            ]
        },
        sourcemap: true
    }
});
