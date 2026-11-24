// Reproduce the state in which the operations tab could not be clicked after touching tsume-shogi rule examples.
const { chromium, openHelp, waitGoalDone } = require('./lib');
(async () => {
  const browser = await chromium.launch();
  const version = process.argv[2];
  const { page } = await openHelp(browser, version, 'phone', 'tsume-shogi');
  await waitGoalDone(page);
  const panels = await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]');
  for (const idx of [5, 6]) {
  const p = panels[idx];
  await p.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const c = await p.evaluate((el) => {
    const h = el.querySelector('[data-how-to-play-press-hint]');
    const f = el.querySelector('figure');
    const r = (h || f).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, hint: !!h };
  });
  console.log('cand', JSON.stringify(c));
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `shots/tsume-shogi/debug-${version}-p${idx}-after-click.png` });
  console.log(idx, 'after click', JSON.stringify(await page.evaluate(() => ({ dialogs: document.querySelectorAll('[role=dialog]').length, tabs: document.querySelectorAll('[role=tab]').length }))));
  for (const [dx, dy] of [[60, 0], [0, 60]]) {
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    for (let s = 1; s <= 8; s++) {
      await page.mouse.move(c.x + (dx * s) / 8, c.y + (dy * s) / 8);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(1300);
  }
  await page.screenshot({ path: `shots/tsume-shogi/debug-${version}-p${idx}-after-drag.png` });
  console.log(idx, JSON.stringify(await page.evaluate(() => ({ dialogs: document.querySelectorAll('[role=dialog]').length, tabs: document.querySelectorAll('[role=tab]').length, url: location.pathname }))));
  }
  const info = await page.evaluate(() => ({
    dialogs: document.querySelectorAll('[role=dialog]').length,
    url: location.href,
    tabs: [...document.querySelectorAll('[role=tab]')].map((t) => t.textContent),
  }));
  console.log(JSON.stringify(info));
  await browser.close();
})();
