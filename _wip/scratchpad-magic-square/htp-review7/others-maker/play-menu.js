// プレイ画面の「…」の位置を、スマートフォン・幅 320px・PC で測る（メニューの図の「画面の右上の「…」」の確かめ）。
const { chromium, ctxOptions, BASES } = require('./lib');
const fs = require('fs');
const path = require('path');
const games = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const game of games) {
    for (const dev of ['phone', 'w320', 'pc']) {
      const ctx = await browser.newContext(ctxOptions(dev));
      const page = await ctx.newPage();
      try {
        await page.goto(BASES.after + '/puzzles/' + game, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        await page.getByRole('button', { name: 'ランダムに遊ぶ' }).click();
        await page.waitForURL(/\/play\//, { timeout: 15000 });
        await page.waitForTimeout(2000);
        out[`${game}-${dev}`] = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => x.querySelector('svg.lucide-ellipsis, svg.lucide-more-horizontal'));
          const r = b ? b.getBoundingClientRect() : null;
          return { vw: innerWidth, btn: r && [Math.round(r.x), Math.round(r.y), Math.round(r.right), Math.round(r.bottom)], label: b && b.getAttribute('aria-label') };
        });
        if (dev !== 'w320') await page.screenshot({ path: path.join('shots', game, `play-${dev}.png`) });
      } catch (e) {
        out[`${game}-${dev}`] = { error: String(e).slice(0, 160) };
      }
      await ctx.close();
    }
  }
  fs.writeFileSync('play-menu.json', JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
  await browser.close();
})();
