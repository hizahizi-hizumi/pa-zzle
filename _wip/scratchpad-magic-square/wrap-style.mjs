import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
function loadPlaywright() {
  const directories = (existsSync("/opt") ? readdirSync("/opt", { withFileTypes: true }) : [])
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("node"))
    .map((entry) => path.join("/opt", entry.name, "lib", "node_modules"));
  for (const base of [import.meta.url, ...directories.map((d) => path.join(d, "_"))]) {
    try { return createRequire(base)("playwright"); } catch {}
  }
  throw new Error("playwright not found");
}
const [url] = process.argv.slice(2);
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
console.log(browser.version());
const { defaultBrowserType: _w, ...iphone13 } = devices["iPhone 13"];
const context = await browser.newContext(iphone13);
const page = await context.newPage();
await page.goto(`${url}/puzzles/takuzu`);
await page.locator("[aria-haspopup]").first().click();
await page.getByRole("menuitem", { name: "遊び方" }).click();
await page.waitForTimeout(1500);
await page.getByRole("tab", { name: "操作" }).click();
await page.waitForTimeout(300);
const info = await page.evaluate(() => {
  const span = [...document.querySelectorAll('[role="tabpanel"][data-state="active"] span.block')].find((s) => s.textContent.includes("やり直します"));
  const cs = getComputedStyle(span);
  // test: plain text with pretty
  const test = document.createElement("div");
  test.style.cssText = "width:260px;font-size:16px;text-wrap:pretty";
  test.innerHTML = '<span style="display:inline-block">あいうえおか</span><span style="display:inline-block">かきくけこ</span><span style="display:inline-block">さしすせそ</span><span style="display:inline-block">たちつてと</span><span style="display:inline-block">なにぬ</span>';
  const test2 = document.createElement("div"); test2.style.cssText = "width:260px;font-size:16px;text-wrap:pretty;word-break:keep-all"; test2.innerHTML = '<span>あいうえおか</span> <span>かきくけこ</span> <span>さしすせそ</span> <span>たちつてと</span> <span>なにぬ</span>'; document.body.append(test2);
  document.body.append(test);
  const tops = [...test.children].map((c) => Math.round(c.getBoundingClientRect().top));
  test.style.textWrap = "wrap";
  const tops2 = [...test.children].map((c) => Math.round(c.getBoundingClientRect().top));
  const t3 = [...test2.children].map((c) => Math.round(c.getBoundingClientRect().top));
  test2.style.textWrap = "wrap";
  const t4 = [...test2.children].map((c) => Math.round(c.getBoundingClientRect().top));
  return { textWrap: cs.textWrap, textWrapStyle: cs.textWrapStyle, tops, tops2, t3, t4 };
});
console.log(JSON.stringify(info));
await browser.close();
