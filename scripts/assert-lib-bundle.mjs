import { readdirSync, readFileSync } from "node:fs";

const distJs = readdirSync("dist").filter(name => name.endsWith(".js"));
const unexpected = distJs.filter(
    name => name !== "index.js" && name !== "server.js"
);

if (unexpected.length > 0) {
    console.error(
        "Library build emitted extra JS chunks (these break npm/Next if omitted):",
        unexpected.join(", ")
    );
    process.exit(1);
}

for (const file of ["dist/index.js", "dist/server.js"]) {
    const source = readFileSync(file, "utf8");
    if (/from ["']\.\//.test(source)) {
        console.error(`${file} still imports a relative chunk; keep entries self-contained.`);
        process.exit(1);
    }
}

console.log("Library bundle check passed: index.js and server.js are self-contained.");
