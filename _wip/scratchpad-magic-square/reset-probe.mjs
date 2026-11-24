// 触れる例の面ごとに、例を1つずつ手がかりどおりに押し、元に戻すボタンがどこに出るかを測って撮る。
// 使い方: node reset-probe.mjs <URL> <出力先> <iphone|pc|narrow> <ゲームID...>
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
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
const [url, out, mode, ...games] = process.argv.slice(2);
const { chromium, devices } = loadPlaywright();
const browser = await chromium.launch();
const { defaultBrowserType: _w, ...iphone13 } = devices["iPhone 13"];
const options = mode === "pc" ? { viewport: { width: 1280, height: 800 } } : mode === "narrow" ? { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : iphone13;
const report = [];
for (const game of games) {
  const dir = path.join(out, game);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${url}/puzzles/${game}`);
  await page.locator("[aria-haspopup]").first().click();
  await page.getByRole("menuitem", { name: "遊び方" }).click();
  await page.waitForTimeout(1500);
  for (const tab of ["ルール", "操作"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(400);
    const panelCount = await page.locator('[role="tabpanel"][data-state="active"] [data-reset-button-placement]').count();
    for (let p = 0; p < panelCount; p += 1) {
      const panel = page.locator('[role="tabpanel"][data-state="active"] [data-reset-button-placement]').nth(p);
      const figureCount = await panel.locator("figure").count();
      for (let f = 0; f < figureCount; f += 1) {
        const figure = panel.locator("figure").nth(f);
        await figure.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(300);
        const hint = figure.locator("[data-how-to-play-press-hint]").first();
        let pressed = "none";
        if (await hint.count()) {
          const box = await hint.boundingBox();
          if (box) {
            if (mode === "pc") await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            else await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
            pressed = "hint";
          }
        }
        await page.waitForTimeout(700);
        const info = await panel.evaluate((el, f) => {
          const button = el.querySelector('button[aria-label="例を元に戻す"]');
          const figure = el.querySelectorAll("figure")[f];
          const b = button.getBoundingClientRect();
          const fr = figure.getBoundingClientRect();
          const pr = el.getBoundingClientRect();
          const header = document.querySelector('[role="tablist"]')?.getBoundingClientRect();
          // ボタンと、例の言葉のほかの部分（盤面・駒台・数の列・入力の段）との最短の間。
          const examples = el.querySelector(".\\@container > div");
          const parts = [...examples.children].flatMap((child) => {
            const figures = child.tagName === "FIGURE" ? [child] : [...child.querySelectorAll("figure")];
            if (figures.length === 0) return [child];
            return figures.flatMap((fig) => [...fig.children].filter((c) => c.tagName !== "FIGCAPTION"));
          });
          let gap = Infinity;
          for (const part of parts) {
            const r = part.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const dx = Math.max(0, r.left - b.right, b.left - r.right);
            const dy = Math.max(0, r.top - b.bottom, b.top - r.bottom);
            gap = Math.min(gap, Math.hypot(dx, dy));
          }
          const style = getComputedStyle(el);
          return {
            gap: Math.round(gap),
            padding: [Math.round(parseFloat(style.paddingTop)), Math.round(parseFloat(style.paddingBottom))],
            placement: el.getAttribute("data-reset-button-placement"),
            side: button.closest("[data-reset-button-side]")?.getAttribute("data-reset-button-side") ?? null,
            enabled: !button.disabled,
            button: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)],
            figure: [Math.round(fr.left), Math.round(fr.top), Math.round(fr.right), Math.round(fr.bottom)],
            panel: [Math.round(pr.top), Math.round(pr.bottom)],
            tabBottom: header ? Math.round(header.bottom) : null,
            vh: window.innerHeight,
          };
        }, f);
        const visible = info.button[1] >= (info.tabBottom ?? 0) && info.button[3] <= info.vh;
        const nearFigure = info.button[1] < info.figure[3] + 60 && info.button[3] > info.figure[1] - 60;
        report.push({ game, tab, panel: p, figure: f, pressed, ...info, visible, nearFigure });
        const top = Math.max(0, Math.min(info.panel[0], info.button[1]) - 10);
        const bottom = Math.min(info.vh, Math.max(info.panel[1], info.button[3]) + 10);
        const width = options.viewport ? options.viewport.width : 390;
        if (bottom > top + 10) {
          await page.screenshot({ path: path.join(dir, `${tab}-p${p}-f${f}.png`), clip: { x: 0, y: top, width, height: bottom - top } });
        }
        const reset = panel.locator('button[aria-label="例を元に戻す"]');
        if (info.enabled) {
          await reset.evaluate((el) => el.click());
          await page.waitForTimeout(300);
        }
      }
    }
  }
  report.push({ game, errors: errors.length, errorText: errors.slice(0, 3) });
  await context.close();
}
writeFileSync(path.join(out, `report-${mode}.json`), JSON.stringify(report, null, 1));
for (const r of report) {
  if (r.errors !== undefined) { console.log(`${r.game} errors=${r.errors}`); continue; }
  console.log(`${r.game} ${r.tab} p${r.panel} f${r.figure} ${r.pressed} ${r.placement}/${r.side ?? "-"} enabled=${r.enabled} visible=${r.visible} near=${r.nearFigure} gap=${r.gap} pad=${r.padding.join("/")} btn=${r.button.join(",")} fig=${r.figure.join(",")}`);
}
await browser.close();
