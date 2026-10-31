import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // vite.config.ts がビルド時に埋め込む値。テストでは内部診断を出さない。
  define: {
    __PA_ZZLE_INTERNAL_DIAGNOSTICS__: "false",
    __PA_ZZLE_BUILD_REVISION__: "null",
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.ts"],
    passWithNoTests: true,
    server: {
      deps: {
        // 外部化すると react-router が別インスタンスで読み込まれ、テスト側の Router コンテキストを参照できない。
        inline: ["@generouted/react-router"],
      },
    },
  },
});
