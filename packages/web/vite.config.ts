import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appSourceDir = resolve(__dirname, "../app/src");
const appDomains = [
  "account",
  "armor",
  "assistant",
  "capabilities",
  "home",
  "items",
  "library",
  "loadouts",
  "settings",
  "vault",
  "vendors"
];
const packageVersion = (JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string }).version;

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageVersion)
  },
  resolve: {
    alias: [
      ...appDomains.map((domain) => ({ find: `@d2-tools/app/${domain}`, replacement: resolve(appSourceDir, `${domain}.ts`) })),
      { find: "@d2-tools/app", replacement: resolve(appSourceDir, "index.ts") },
      { find: "@d2-tools/ui/styles.css", replacement: resolve(__dirname, "../ui/src/styles.css") },
      { find: "@d2-tools/ui/fixtures", replacement: resolve(__dirname, "../ui/src/fixtures.ts") },
      { find: "@d2-tools/ui", replacement: resolve(__dirname, "../ui/src/index.ts") }
    ]
  }
});
