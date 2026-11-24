const { openHelp, scrollInfo, setScroll, OUT } = require('./lib');
(async () => {
  const kind = process.argv[2] || 'sp';
  const { browser, page, errs } = await openHelp(kind);
  const tl = await page.evaluate(() => { const r = document.querySelector('[role=tablist]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom }; });
  console.log('tablist', tl);
  for (const tab of ['ルール', '操作', '採点']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(500);
    const info = await scrollInfo(page);
    const max = info.sh - info.ch;
    let shot = 0;
    for (let y = 0; y <= max; y += 23) {
      await setScroll(page, y);
      await page.waitForTimeout(30);
      const bad = await page.evaluate(() => {
        const tlEl = document.querySelector('[role=tablist]');
        const r = tlEl.getBoundingClientRect();
        // header area from top of dialog to bottom of tablist
        const d = document.querySelector('[role=dialog]');
        const out = [];
        for (let x = 4; x < window.innerWidth; x += 6) {
          for (let yy = 1; yy < r.bottom; yy += 3) {
            const e = document.elementFromPoint(x, yy);
            if (!e) continue;
            // is e inside a tabpanel?
            if (e.closest('[role=tabpanel]')) out.push(`${x},${yy}:${e.tagName}.${(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || '').toString().slice(0, 40)}|${(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,15)}`);
          }
        }
        return out.slice(0, 5).concat(out.length ? ['count=' + out.length] : []);
      });
      if (bad.length) {
        console.log(tab, y, bad.join(' ; '));
        if (shot < 4) { await page.screenshot({ path: `${OUT}${kind}-overlap-${tab}-${y}.png` }); shot++; }
      }
    }
    await setScroll(page, 0);
  }
  console.log(errs.join('\n'));
  await browser.close();
})();
