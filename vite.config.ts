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
            entry: "src/index.ts",
            formats: ["es"],
            name: "ChatWidget",
            fileName: () => "index.js"
        },
        rollupOptions: {
            output: {
                // Vite lib build drops `'use client'` from the entry; Next needs it on the emitted file.
                banner: '"use client";',
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
