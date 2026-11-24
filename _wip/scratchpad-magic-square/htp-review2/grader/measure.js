const { openHelp } = require('./lib');
(async () => {
  const kind = process.argv[2] || 'sp';
  const { browser, page } = await openHelp(kind === 'sp' ? 'sptall' : 'pc', { height: kind === 'sp' ? 3000 : 800 });
  await page.waitForTimeout(4500);
  const r = await page.evaluate(() => {
    const R = e => { const b = e.getBoundingClientRect(); return `x=${b.x.toFixed(1)}..${(b.x + b.width).toFixed(1)} y=${b.y.toFixed(1)}..${(b.y + b.height).toFixed(1)} cx=${(b.x + b.width / 2).toFixed(1)}`; };
    const out = [];
    const top = document.querySelector('[role=dialog] .isolate');
    const cells = top.querySelectorAll('button[aria-label*="行"]');
    const frame = cells[0].closest('[class*="rounded"]')?.parentElement;
    out.push('goal cell0 ' + R(cells[0]) + ' cell15 ' + R(cells[15]));
    // all text nodes in goal area: sums
    const texts = [];
    top.querySelectorAll('*').forEach(e => { if (e.children.length === 0 && /^\d+$|^合計$/.test(e.textContent.trim()) && !e.closest('button')) { const b = e.getBoundingClientRect(); if (b.width) texts.push(`${e.textContent.trim()}@(${b.x.toFixed(0)},${b.y.toFixed(0)},${b.width.toFixed(0)}x${b.height.toFixed(0)})`); } });
    out.push('goal labels: ' + texts.join(' '));
    const replay = top.querySelector('button[aria-label="始まりの盤面から見せ直す"]');
    out.push('replay ' + R(replay));
    const tut = Array.from(top.querySelectorAll('button')).find(b => b.textContent.includes('チュートリアル'));
    out.push('tutorial ' + R(tut));
    const desc = top.querySelector('p'); out.push('desc ' + R(desc));
    // rule panels
    const panel = document.querySelector('[role=tabpanel][data-state=active]');
    panel.querySelectorAll(':scope > div > section').forEach((s, i) => {
      const box = s.querySelector('.rounded-lg');
      out.push(`sec${i} panel ` + R(box));
      const c = s.querySelectorAll('button[aria-label*="行"]');
      if (c.length) out.push(`  cell0 ` + R(c[0]) + ` cellLast ` + R(c[c.length - 1]));
      const keys = Array.from(s.querySelectorAll('button:not([aria-label])'));
      if (keys.length) out.push(`  key1 ` + R(keys[0]) + ` key16 ` + R(keys[15]));
      const capt = Array.from(s.querySelectorAll('*')).filter(e => e.children.length === 0 && /そろう|そろわない|置けない|変えられる/.test(e.textContent));
      capt.forEach(cp => { const b = cp.getBoundingClientRect(); if (b.width) out.push(`  caption "${cp.textContent.trim()}" ` + R(cp)); });
      const reset = s.querySelector('button[aria-label="例を元に戻す"]'); if (reset) out.push('  reset ' + R(reset) + ' visible=' + getComputedStyle(reset).visibility + ' op=' + getComputedStyle(reset.parentElement).opacity);
    });
    return out.join('\n');
  });
  console.log(r);
  await browser.close();
})();
