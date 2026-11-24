// 文節で折り返す文の行ごとの中身を出す: node lines.js <version> <dev> <game> <tab> <文の一部>
const { chromium, openHelp, waitGoalDone } = require('./lib');
const TABS = { rules: 'ルール', operations: '操作', scoring: '採点' };
(async () => {
  const [version, dev, game, tab, needle] = process.argv.slice(2);
  const browser = await chromium.launch();
  const { page } = await openHelp(browser, version, dev, game);
  await waitGoalDone(page);
  await page.getByRole('tab', { name: TABS[tab] }).click();
  await page.waitForTimeout(500);
  const res = await page.evaluate((needle) => {
    const out = [];
    const panel = document.querySelector('[role=tabpanel][data-state=active]');
    const blocks = new Set([...panel.querySelectorAll('span.inline-block')].map((s) => s.parentElement));
    for (const b of blocks) {
      if (!b.textContent.includes(needle)) continue;
      const lines = new Map();
      for (const s of b.children) {
        if (!s.matches('span.inline-block')) continue;
        const k = Math.round(s.getBoundingClientRect().top);
        lines.set(k, (lines.get(k) || '') + s.textContent + '/');
      }
      out.push([...lines.values()]);
    }
    return out;
  }, needle);
  console.log(`${game} ${version} ${dev}: ${JSON.stringify(res)}`);
  await browser.close();
})();
