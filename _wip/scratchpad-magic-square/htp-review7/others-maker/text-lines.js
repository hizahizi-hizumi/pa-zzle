// メニューの図の説明と採点の行の文を、行ごとの中身で書き出す: node text-lines.js <version> <dev> <game...>
const fs = require('fs');
const { chromium, openHelp, waitGoalDone } = require('./lib');
(async () => {
  const [version, dev, ...games] = process.argv.slice(2);
  const browser = await chromium.launch();
  const out = {};
  for (const game of games) {
    const { ctx, page } = await openHelp(browser, version, dev, game);
    await waitGoalDone(page);
    out[game] = {};
    for (const [key, label] of [['operations', '操作'], ['scoring', '採点']]) {
      await page.getByRole('tab', { name: label }).click();
      await page.waitForTimeout(500);
      out[game][key] = await page.evaluate((key) => {
        const panel = document.querySelector('[role=tabpanel][data-state=active]');
        const blocks = new Set([...panel.querySelectorAll('span.inline-block')].map((s) => s.parentElement));
        const res = [];
        for (const b of blocks) {
          const inMenu = !!b.closest('[data-slot=dropdown-menu-static-surface]');
          const inScoreText = b.matches('p.mt-1') && !!b.closest('li');
          const isMenuLead = !inMenu && b.textContent.includes('「…」');
          if (!(inMenu || inScoreText || isMenuLead)) continue;
          const lines = new Map();
          for (const s of b.children) {
            if (!s.matches('span.inline-block')) continue;
            const k = Math.round(s.getBoundingClientRect().top);
            lines.set(k, (lines.get(k) || '') + s.textContent);
          }
          res.push({ where: inMenu ? 'menu' : isMenuLead ? 'menu-lead' : 'score', lines: [...lines.values()] });
        }
        return res;
      }, key);
    }
    await ctx.close();
  }
  fs.writeFileSync(`text-lines-${version}-${dev}.json`, JSON.stringify(out, null, 1));
  await browser.close();
})();
