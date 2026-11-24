const { openHelp } = require('./lib');
const [tab, step] = [process.argv[2], Number(process.argv[3] || 30)];
(async () => {
  const { browser, page } = await openHelp('sp');
  await page.waitForTimeout(4500);
  if (tab !== 'ルール') { await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(500); }
  const panel = page.locator('[role=tabpanel][data-state=active]');
  // put a selection in the first two examples to show rings/hints
  const cells = panel.locator('button[aria-label*="行"]');
  await cells.first().evaluate(e => e.scrollIntoView({ block: 'center' }));
  if (tab !== '採点') { await cells.nth(0).tap(); await page.waitForTimeout(300); }
  const sc = page.locator('[role=dialog] .overflow-y-auto').first();
  const total = await sc.evaluate(e => e.scrollHeight - e.clientHeight);
  let i = 0;
  for (let y = 0; y <= total; y += step) {
    await sc.evaluate((e, v) => { e.scrollTop = v; }, y);
    await page.waitForTimeout(60);
    await page.screenshot({ path: `fine/${tab}-${String(i++).padStart(3,'0')}.png`, clip: { x: 0, y: 40, width: 390, height: 110 } });
  }
  console.log(tab, 'frames', i, 'total', total);
  await browser.close();
})();
