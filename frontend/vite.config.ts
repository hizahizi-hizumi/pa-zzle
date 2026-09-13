import { fileURLToPath } from "node:url";
import generouted from "@generouted/react-router/plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const frontendRoot = fileURLToPath(new URL("./", import.meta.url));
const sourceRoot = fileURLToPath(new URL("./src/", import.meta.url));
const pagesRoot = fileURLToPath(new URL("./src/pages/", import.meta.url));
const routerPath = fileURLToPath(new URL("./src/router.ts", import.meta.url));
const outputDir = fileURLToPath(new URL("./dist/", import.meta.url));

export default defineConfig({
  root: frontendRoot,
  plugins: [
    react(),
    tailwindcss(),
    generouted({
      source: {
        routes: `${pagesRoot}**/[\\w[-]*.{jsx,tsx,mdx}`,
        modals: `${pagesRoot}**/[+]*.{jsx,tsx,mdx}`,
      },
      output: routerPath,
    }),
  ],
  resolve: {
    alias: {
      "@": sourceRoot,
    },
  },
  build: {
    outDir: outputDir,
    emptyOutDir: true,
  },
});
