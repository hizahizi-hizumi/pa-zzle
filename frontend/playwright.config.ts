import { env } from "node:process";
import { defineConfig, devices } from "@playwright/test";

const previewPort = 4319;
const previewOrigin = `http://127.0.0.1:${previewPort}`;
const isCi = env.CI !== undefined;

// biome-ignore lint/style/noDefaultExport: Playwright は設定を default export から読む。
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "./e2e-results/test-output",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: 0,
  reporter: "list",
  expect: {
    // クリアの演出や効果音の読み込みを待ってから次の画面へ移るので、既定の 5 秒では足りないことがある。
    timeout: 15_000,
  },
  use: {
    baseURL: previewOrigin,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `bun run build && bunx vite preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
    url: previewOrigin,
    // 既に動いている配信を使い回すと、古いビルドを検査してしまう。
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
