// Check where the play screen's "…" menu button sits (phone and PC) for each game.
const { chromium, ctxOptions, BASES } = require('./lib');
const fs = require('fs');
const games = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const game of games) {
    for (const dev of ['phone', 'pc']) {
      const ctx = await browser.newContext(ctxOptions(dev));
      const page = await ctx.newPage();
      try {
        await page.goto(BASES.after + '/puzzles/' + game, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        await page.getByRole('button', { name: 'ランダムに遊ぶ' }).click();
        await page.waitForURL(/\/play\//, { timeout: 15000 });
        await page.waitForTimeout(2500);
        const info = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => x.querySelector('svg.lucide-ellipsis, svg.lucide-more-horizontal'));
          const r = b ? b.getBoundingClientRect() : null;
          return { vw: innerWidth, vh: innerHeight, btn: r && { x: r.x, y: r.y, r: r.right, b: r.bottom }, label: b && b.getAttribute('aria-label') };
        });
        out[`${game}-${dev}`] = info;
        await page.screenshot({ path: `shots/${game}/play-${dev}.png` });
      } catch (e) {
        out[`${game}-${dev}`] = { error: String(e).slice(0, 200) };
      }
      await ctx.close();
    }
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('play-menu.json', JSON.stringify(out, null, 1));
  await browser.close();
})();
