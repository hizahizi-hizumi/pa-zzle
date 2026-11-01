// capture-screens.mjs
// 指定した画面を幅とテーマの組ごとに開いてスクリーンショットを撮り、
// ブラウザエラーと横スクロールの有無を <出力先>/browser-check.txt に書く。
// 画面を開いて撮るだけで、操作はしない。操作してクリアまで進める確認は playtest-driver.mjs で行う。
//
// 端末: 幅 600 未満は Playwright の devices['iPhone 13']（390×664 = Safari の表示領域相当、タッチ、isMobile）の
// 幅だけを差し替えたもの。600 以上は高さ 800 の PC（既定 1280×800）。画像は scale: 'css'（画像の1px = CSS の1px）で撮る。
//
// 使い方:
//   node capture-screens.mjs \
//     --base-url http://localhost:5173 --game <game> --screens <screens.json> --out <出力先> \
//     [--widths 390,1280] [--themes light]
// テーマ: アプリは今ダーク表示に切り替えないので既定は light だけ。dark は <html> に .dark を付けて撮る
// （globals.css の .dark の見た目。アプリがダークに切り替える仕組みを持つまでは参考）。
// screens.json: [{ "path": "/puzzles/<game>", "name": "difficulty" }, ...]
// 出力: <出力先>/<game>__<name>__<幅>__<テーマ>.png と <出力先>/browser-check.txt
// 終了コード: ブラウザエラーか横スクロールが1件でもあれば 1。

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";

// playwright はリポジトリの依存に無く、環境の全体インストール（NODE_PATH や /opt/node*/lib/node_modules）から読む。
function loadPlaywright() {
  const globalModuleDirectories = [
    ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
    ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
      .map((entry) => path.join("/opt", entry.name, "lib", "node_modules")),
  ];
  for (const base of [import.meta.url, ...globalModuleDirectories.map((directory) => path.join(directory, "_"))]) {
    try {
      return createRequire(base)("playwright");
    } catch {}
  }
  console.error("ERROR: playwright が見つからない。NODE_PATH に playwright のある node_modules を指定する");
  process.exit(2);
}

const { chromium, devices } = loadPlaywright();
const { defaultBrowserType: _webkitOnly, ...iphone13 } = devices["iPhone 13"];

const PHONE_WIDTH_LIMIT = 600;
const DESKTOP_HEIGHT = 800;
const FILE_NAME_SEPARATOR = "__";

const { values: options } = parseArgs({
  options: {
    "base-url": { type: "string" },
    game: { type: "string" },
    screens: { type: "string" },
    out: { type: "string" },
    widths: { type: "string", default: "390,1280" },
    themes: { type: "string", default: "light" },
  },
});

for (const required of ["base-url", "game", "screens", "out"]) {
  if (!options[required]) {
    console.error(`ERROR: --${required} が必要`);
    process.exit(2);
  }
}

const baseUrl = options["base-url"].replace(/\/$/, "");
const screens = JSON.parse(readFileSync(options.screens, "utf8"));
const widths = options.widths.split(",").map(Number);
const themes = options.themes.split(",");

for (const screen of screens) {
  if (!screen.path?.startsWith("/") || !screen.name || screen.name.includes(FILE_NAME_SEPARATOR)) {
    console.error(`ERROR: 画面の指定が不正: ${JSON.stringify(screen)}（path は / で始め、name に ${FILE_NAME_SEPARATOR} を含めない）`);
    process.exit(2);
  }
}

mkdirSync(options.out, { recursive: true });

function contextOptionsFor(width, theme) {
  if (width < PHONE_WIDTH_LIMIT) {
    return { ...iphone13, viewport: { ...iphone13.viewport, width }, colorScheme: theme };
  }
  return { viewport: { width, height: DESKTOP_HEIGHT }, colorScheme: theme };
}

const checkLines = [];
let problemCount = 0;
const browser = await chromium.launch();
try {
  // 開発サーバーは初回の読み込みで依存を最適化し直し、その間の要求に 504 (Outdated Optimize Dep) を返すことがある。
  // 撮る前に全画面を一度開いて落ち着かせ、そのエラーを撮影の結果に混ぜない。
  const warmUpPage = await browser.newPage();
  for (const screen of screens) await warmUpPage.goto(baseUrl + screen.path, { waitUntil: "networkidle" });
  await warmUpPage.close();
  for (const width of widths) {
    for (const theme of themes) {
      const context = await browser.newContext(contextOptionsFor(width, theme));
      if (theme === "dark") {
        await context.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => document.documentElement.classList.add("dark"));
        });
      }
      const page = await context.newPage();
      let errors = [];
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
      });
      for (const screen of screens) {
        errors = [];
        await page.goto(baseUrl + screen.path, { waitUntil: "networkidle" });
        const horizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        const fileName = [options.game, screen.name, width, theme].join(FILE_NAME_SEPARATOR) + ".png";
        await page.screenshot({ path: path.join(options.out, fileName), fullPage: true, scale: "css" });
        problemCount += errors.length + (horizontalOverflow ? 1 : 0);
        checkLines.push(
          `${fileName}\t${screen.path}\terrors=${errors.length}\thorizontal-overflow=${horizontalOverflow ? "yes" : "no"}`,
          ...errors.map((error) => `  ${error}`),
        );
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const summary = `problems: ${problemCount}（ブラウザエラーと横スクロールの合計。画面 ${screens.length} × 幅 ${widths.length} × テーマ ${themes.length}）`;
writeFileSync(path.join(options.out, "browser-check.txt"), [summary, ...checkLines, ""].join("\n"));
console.log(summary);
process.exit(problemCount === 0 ? 0 : 1);
