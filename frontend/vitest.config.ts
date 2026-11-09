import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// 各ゲームの puzzle/・problem/・session/・tutorial/ とゲーム直下、scripts/ は画面に依存しないので DOM なしで動かす。
const logicTestFiles = [
  "src/games/*/{puzzle,problem,session,tutorial}/**/*.test.ts",
  "src/games/*/*.test.ts",
  "scripts/**/*.test.ts",
];

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
    globals: true,
    passWithNoTests: true,
    server: {
      deps: {
        // 外部化すると react-router が別インスタンスで読み込まれ、テスト側の Router コンテキストを参照できない。
        inline: ["@generouted/react-router"],
      },
    },
    projects: [
      {
        test: {
          name: "logic",
          environment: "node",
          // vm の中では計算の重い探索が数倍遅くなるので、vm を使わない。
          pool: "forks",
          include: logicTestFiles,
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["src/testing/setup-dom.ts"],
          // forks ではファイルごとに jsdom の環境を用意する時間が大半を占めるので、それが軽い vm を使う。
          pool: "vmForks",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: [...configDefaults.exclude, ...logicTestFiles],
        },
      },
    ],
  },
});
