const { openHelp } = require('./lib');
(async () => {
  const kind = process.argv[2] || 'sp';
  const { browser, page } = await openHelp(kind === 'sp' ? 'sptall' : 'pc', { height: 3000 });
  await page.waitForTimeout(4500);
  const dump = async (label) => {
    const rows = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      const paras = new Set();
      d.querySelectorAll('span.inline-block').forEach(s => { const p = s.parentElement; const tp = p.closest('[role=tabpanel]'); if (tp && tp.getAttribute('data-state') !== 'active') return; if (p.closest('.sr-only')) return; paras.add(p); });
      const out = [];
      paras.forEach(p => {
        const spans = Array.from(p.children).filter(c => c.classList.contains('inline-block'));
        const lines = [];
        let cur = null, y = null;
        spans.forEach(s => { const r = s.getBoundingClientRect(); if (r.width === 0) return; if (y === null || Math.abs(r.y - y) > 4) { cur = []; lines.push(cur); y = r.y; } cur.push(s.textContent); });
        const pr = p.getBoundingClientRect();
        out.push(`[${p.tagName} w=${Math.round(pr.width)}] ` + lines.map(l => l.join('')).join(' ⏎ '));
      });
      return out;
    });
    console.log('== ' + label); console.log(rows.join('\n'));
  };
  await dump('ルール');
  await page.getByRole('tab', { name: '操作' }).click(); await page.waitForTimeout(400); await dump('操作');
  await page.getByRole('tab', { name: '採点' }).click(); await page.waitForTimeout(400); await dump('採点');
  await browser.close();
})();
