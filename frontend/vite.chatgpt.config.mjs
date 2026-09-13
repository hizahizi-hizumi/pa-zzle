import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const frontendRoot = fileURLToPath(new URL("./src/", import.meta.url));
const outputDir = fileURLToPath(new URL("./dist-chatgpt/", import.meta.url));

export default defineConfig({
  root: frontendRoot,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: outputDir,
    emptyOutDir: true,
  },
});
