const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [port, game, dev, tab] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext(dev === 'sp' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/puzzles/${game}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: tab || 'ルール' }).click();
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')];
    return ps.map((p, i) => ({ i, place: p.dataset.resetButtonPlacement, figs: [...p.querySelectorAll('figure')].map(f => [...f.querySelectorAll('[aria-label],button,[role=button]')].slice(0, 14).map(e => (e.tagName + ':' + (e.getAttribute('aria-label') || '').slice(0, 30)))) }));
  });
  console.log(JSON.stringify(info, null, 0).slice(0, 4000));
  await browser.close();
})();
