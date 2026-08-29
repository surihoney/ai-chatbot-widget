import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

const external = [
    "react",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-dom",
    "react-dom/client"
];

const dtsOptions = {
    include: ["src"],
    exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"]
};

function libConfig(options: {
    entry: string;
    fileName: string;
    emptyOutDir: boolean;
    banner?: string;
}): UserConfig {
    return {
        plugins: [react(), dts(dtsOptions)],
        publicDir: false,
        build: {
            emptyOutDir: options.emptyOutDir,
            lib: {
                entry: options.entry,
                formats: ["es"],
                fileName: () => options.fileName
            },
            rollupOptions: {
                external,
                output: {
                    // One file per entry — no shared hashed chunks for npm to omit.
                    inlineDynamicImports: true,
                    ...(options.banner ? { banner: options.banner } : {})
                }
            },
            sourcemap: true
        }
    };
}

export default defineConfig(({ mode }) => {
    if (mode === "server") {
        return libConfig({
            entry: "src/server.ts",
            fileName: "server.js",
            emptyOutDir: false
        });
    }

    return libConfig({
        entry: "src/index.ts",
        fileName: "index.js",
        emptyOutDir: true,
        banner: '"use client";'
    });
});
