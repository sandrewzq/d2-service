import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const appSourceDir = fileURLToPath(new URL("../app/src", import.meta.url));
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

export default defineConfig({
  root: currentDir,
  base: "./",
  plugins: [react()],
  resolve: {
    alias: [
      ...appDomains.map((domain) => ({ find: `@d2-tools/app/${domain}`, replacement: `${appSourceDir}/${domain}.ts` })),
      { find: "@d2-tools/app", replacement: `${appSourceDir}/index.ts` },
      { find: "@d2-tools/ui/styles.css", replacement: fileURLToPath(new URL("../ui/src/styles.css", import.meta.url)) },
      { find: "@d2-tools/ui", replacement: fileURLToPath(new URL("../ui/src/index.ts", import.meta.url)) }
    ]
  },
  build: {
    outDir: "dist/renderer",
    emptyOutDir: false,
    target: "es2022",
    rollupOptions: {
      input: fileURLToPath(new URL("index.html", import.meta.url)),
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"]
        }
      }
    }
  }
});
