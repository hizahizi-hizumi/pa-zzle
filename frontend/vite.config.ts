import { env } from "node:process";
import { fileURLToPath } from "node:url";
import generouted from "@generouted/react-router/plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { uiFontSubset } from "./vite-plugins/ui-font-subset.ts";

const frontendRoot = fileURLToPath(new URL("./", import.meta.url));
const sourceRoot = fileURLToPath(new URL("./src/", import.meta.url));
const pagesRoot = fileURLToPath(new URL("./src/pages/", import.meta.url));
const routerPath = fileURLToPath(new URL("./src/router.ts", import.meta.url));
const outputDir = fileURLToPath(new URL("./dist/", import.meta.url));
const uiFontDir = fileURLToPath(
  new URL("./generated/ui-font/", import.meta.url),
);
const internalDiagnosticsEnabled = env.PA_ZZLE_INTERNAL_DIAGNOSTICS === "true";
const uiFontSubsetFamily = "Zen Kaku Gothic New Subset";
const buildRevision = env.WORKERS_CI_COMMIT_SHA ?? env.GITHUB_SHA ?? null;

export default defineConfig({
  root: frontendRoot,
  plugins: [
    react(),
    tailwindcss(),
    uiFontSubset({
      root: frontendRoot,
      outputDir: uiFontDir,
      fontFamily: uiFontSubsetFamily,
    }),
    generouted({
      source: {
        routes: `${pagesRoot}**/[\\w[-]*.{jsx,tsx,mdx}`,
        modals: `${pagesRoot}**/[+]*.{jsx,tsx,mdx}`,
      },
      output: routerPath,
    }),
  ],
  define: {
    __PA_ZZLE_INTERNAL_DIAGNOSTICS__: JSON.stringify(
      internalDiagnosticsEnabled,
    ),
    __PA_ZZLE_BUILD_REVISION__: JSON.stringify(buildRevision),
    __PA_ZZLE_UI_FONT_SUBSET_FAMILY__: JSON.stringify(uiFontSubsetFamily),
  },
  resolve: {
    alias: {
      "@": sourceRoot,
    },
  },
  build: {
    outDir: outputDir,
    emptyOutDir: true,
    // 効果音は鳴らす設定のときだけ読み込むので、小さくても JS に埋め込まず別のファイルにする。
    assetsInlineLimit: (filePath) =>
      filePath.endsWith(".flac") ? false : undefined,
  },
});
