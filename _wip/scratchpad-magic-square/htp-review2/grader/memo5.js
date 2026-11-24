const { openHelp } = require('./lib');
(async () => {
  const { browser, page } = await openHelp('sp');
  await page.waitForTimeout(4500);
  await page.getByRole('tab', { name: '操作' }).tap(); await page.waitForTimeout(500);
  const li = page.locator('[role=tabpanel][data-state=active] li').nth(2);
  await li.locator('.rounded-lg').first().evaluate(e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
  await li.locator('button[aria-label*="行"]').nth(2).tap();
  await li.getByRole('button', { name: 'メモ', exact: true }).tap();
  const key = v => li.locator('button:not([aria-label])').filter({ hasText: new RegExp('^' + v + '$') });
  for (const v of [5, 11, 2, 3]) { await key(v).tap(); await page.waitForTimeout(150); }
  await li.evaluate(s => { window.__rec = []; const t0 = performance.now(); (function f() { for (const e of s.querySelectorAll('*')) { const tr = getComputedStyle(e).transform; const m = tr && tr.match(/matrix\(([^)]+)\)/); if (m) { const v = m[1].split(',').map(Number); if (Math.abs(v[4]) > 0.05 && Math.abs(v[4] + 8.79688) > 0.05) window.__rec.push([Math.round(performance.now() - t0), e.tagName, v[4].toFixed(2)]); } } if (performance.now() - t0 < 900) requestAnimationFrame(f); })(); });
  await key(6).tap(); await page.waitForTimeout(1000);
  const rec = await page.evaluate(() => window.__rec);
  console.log('frames', rec.length, 'max', rec.reduce((m, r) => Math.max(m, Math.abs(+r[2])), 0));
  await browser.close();
})();
