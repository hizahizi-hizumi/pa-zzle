// 狭い画面で、盤面のマスと数の欄のボタンの大きさを測り、撮る。
// 使い方: node measure-narrow.mjs <アプリの URL> <画像の出力先>
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

function loadPlaywright() {
  const directories = [
    ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean),
    ...(existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
      .map((entry) => path.join("/opt", entry.name, "lib", "node_modules")),
  ];
  for (const base of [import.meta.url, ...directories.map((d) => path.join(d, "_"))]) {
    try {
      return createRequire(base)("playwright");
    } catch {}
  }
  throw new Error("playwright not found");
}

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const { chromium } = loadPlaywright();
const viewports = [
  [320, 568],
  [360, 640],
  [390, 664],
];
const problems = [
  ["4x4", "01jc7rv79g"],
  ["5x5", "ehu2h1umg1"],
  ["6x6", "ocdsrm00v9"],
];
const browser = await chromium.launch();
for (const [width, height] of viewports) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  for (const [name, problemId] of problems) {
    await page.goto(`${url}/puzzles/magic-square/play/${problemId}`);
    await page.waitForSelector('[aria-label="数の欄"] button');
    await page.waitForTimeout(500);
    const measured = await page.evaluate(() => {
      const rect = (element) => element.getBoundingClientRect();
      const cells = [...document.querySelectorAll('[aria-label="魔方陣の盤面"] button')].map(rect);
      const padButtons = [...document.querySelectorAll('[aria-label="数の欄"] button')].map(rect);
      const values = padButtons.slice(0, cells.length);
      const trailing = padButtons.slice(cells.length);
      const pad = rect(document.querySelector('[aria-label="数の欄"]'));
      const frame = rect(document.querySelector('[aria-label="魔方陣の盤面"]'));
      return {
        cell: Math.min(...cells.map((r) => Math.min(r.width, r.height))).toFixed(1),
        valueW: Math.min(...values.map((r) => r.width)).toFixed(1),
        valueH: Math.min(...values.map((r) => r.height)).toFixed(1),
        trailing: trailing.map((r) => `${r.width.toFixed(0)}x${r.height.toFixed(0)}`).join(","),
        frameTop: frame.top.toFixed(0),
        frameBottom: frame.bottom.toFixed(0),
        padTop: pad.top.toFixed(0),
        padBottom: pad.bottom.toFixed(0),
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        scrollable: document.documentElement.scrollHeight > window.innerHeight,
      };
    });
    const file = path.join(out, `${width}x${height}-${name}.png`);
    await page.screenshot({ path: file });
    console.log(`${width}x${height} ${name}`, JSON.stringify(measured));
  }
  await context.close();
}
await browser.close();
