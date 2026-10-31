// capture-screens.mjs
// 指定した画面を幅とテーマの組ごとに開いてスクリーンショットを撮り、
// ブラウザエラーと横スクロールの有無を <出力先>/browser-check.txt に書く。
// 画面を開いて撮るだけで、操作はしない。操作してクリアまで進める確認は別のスクリプトで行う。
//
// 使い方:
//   NODE_PATH="$(npm root -g)" node capture-screens.mjs \
//     --base-url http://localhost:5173 --game <game> --screens <screens.json> --out <出力先> \
//     [--widths 390,1280] [--themes light,dark]
// screens.json: [{ "path": "/puzzles/<game>", "name": "difficulty" }, ...]
// 出力: <出力先>/<game>__<name>__<幅>__<テーマ>.png と <出力先>/browser-check.txt
// 終了コード: ブラウザエラーか横スクロールが1件でもあれば 1。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PHONE_WIDTH_LIMIT = 600;
const PHONE_HEIGHT = 844;
const DESKTOP_HEIGHT = 800;
const FILE_NAME_SEPARATOR = "__";

const { values: options } = parseArgs({
  options: {
    "base-url": { type: "string" },
    game: { type: "string" },
    screens: { type: "string" },
    out: { type: "string" },
    widths: { type: "string", default: "390,1280" },
    themes: { type: "string", default: "light,dark" },
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

function viewportFor(width) {
  return { width, height: width < PHONE_WIDTH_LIMIT ? PHONE_HEIGHT : DESKTOP_HEIGHT };
}

const checkLines = [];
let problemCount = 0;
const browser = await chromium.launch();
try {
  for (const width of widths) {
    for (const theme of themes) {
      const page = await browser.newPage({
        viewport: viewportFor(width),
        colorScheme: theme,
        hasTouch: width < PHONE_WIDTH_LIMIT,
      });
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
        await page.screenshot({ path: path.join(options.out, fileName), fullPage: true });
        problemCount += errors.length + (horizontalOverflow ? 1 : 0);
        checkLines.push(
          `${fileName}\t${screen.path}\terrors=${errors.length}\thorizontal-overflow=${horizontalOverflow ? "yes" : "no"}`,
          ...errors.map((error) => `  ${error}`),
        );
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const summary = `problems: ${problemCount}（ブラウザエラーと横スクロールの合計。画面 ${screens.length} × 幅 ${widths.length} × テーマ ${themes.length}）`;
writeFileSync(path.join(options.out, "browser-check.txt"), [summary, ...checkLines, ""].join("\n"));
console.log(summary);
process.exit(problemCount === 0 ? 0 : 1);
