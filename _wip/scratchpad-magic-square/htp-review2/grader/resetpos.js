const { openHelp } = require('./lib');
(async () => {
  const kind = process.argv[2];
  const { browser, page } = await openHelp(kind, { dsf: 1 });
  await page.waitForTimeout(4500);
  for (const tab of ['ルール', '操作']) {
    await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(400);
    const panel = page.locator('[role=tabpanel][data-state=active]');
    const boxes = panel.locator('.rounded-lg.bg-muted');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) {
      const b = boxes.nth(i);
      await b.evaluate(e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(250);
      const cell = b.locator('button[aria-label*="空き"]').first();
      if (await cell.count()) { if (kind === 'sp') await cell.tap(); else await cell.click(); }
      await page.waitForTimeout(400);
      const info = await b.evaluate(e => { const r = e.getBoundingClientRect(); const rb = e.querySelector('button[aria-label="例を元に戻す"]').getBoundingClientRect(); return `panel y ${r.y.toFixed(0)}..${(r.y+r.height).toFixed(0)} x ${r.x.toFixed(0)}..${(r.x+r.width).toFixed(0)} reset y ${rb.y.toFixed(0)}..${(rb.y+rb.height).toFixed(0)} x ${rb.x.toFixed(0)}..${(rb.x+rb.width).toFixed(0)} (top gap ${(rb.y-r.y).toFixed(0)}, bottom gap ${(r.y+r.height-rb.y-rb.height).toFixed(0)}, right gap ${(r.x+r.width-rb.x-rb.width).toFixed(0)})`; });
      console.log(kind, tab, i, info);
      await b.screenshot({ path: `resetpos/${kind}-${tab}-${i}.png` });
    }
  }
  await browser.close();
})();
