const { openHelp } = require('./lib');
(async () => {
  const { browser, page, errors } = await openHelp('sp');
  await page.waitForTimeout(5000);
  const panel = page.locator('[role=tabpanel][data-state=active]');
  const s2 = panel.locator(':scope > div > section').nth(2);
  await s2.locator('.rounded-lg').first().evaluate(e => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await s2.locator('button[aria-label*="行"]').nth(0).tap();
  await page.waitForTimeout(500);
  await s2.evaluate(s => {
    window.__rec = [];
    const t0 = performance.now();
    function f() {
      const els = Array.from(s.querySelectorAll('*'));
      for (const e of els) {
        const tr = getComputedStyle(e).transform;
        if (tr && tr !== 'none') {
          const m = tr.match(/matrix\(([^)]+)\)/);
          if (m) { const v = m[1].split(',').map(Number); if (Math.abs(v[4]) > 0.01 && Math.abs(v[4] + 8.79688) > 0.01) window.__rec.push([Math.round(performance.now() - t0), e.tagName + '.' + (e.className.baseVal ?? e.className).toString().slice(0, 40), v[4].toFixed(2), v[5].toFixed(2)]); }
        }
      }
      if (performance.now() - t0 < 1200) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  });
  await s2.locator('button:not([aria-label])').filter({ hasText: /^7$/ }).tap();
  await page.waitForTimeout(1400);
  const rec = await page.evaluate(() => window.__rec);
  const max = rec.reduce((m, r) => Math.max(m, Math.abs(Number(r[2]))), 0);
  console.log('frames', rec.length, 'max |dx|', max);
  console.log(rec.slice(0, 40).map(r => r.join(' ')).join('\n'));
  // Also check: does the given-cell example panel announce anything (aria-live text)?
  await browser.close();
})();
