const { openHelp } = require('./lib');
(async () => {
  const { browser, page, errors } = await openHelp('sp');
  const out = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const lines = [];
    function walk(el, depth) {
      if (depth > 9) return;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const ov = cs.overflowY;
      const pos = cs.position;
      const cls = (el.className && el.className.baseVal === undefined ? el.className : '').toString().slice(0, 140);
      lines.push(' '.repeat(depth * 2) + el.tagName.toLowerCase() + (el.getAttribute('role') ? '[' + el.getAttribute('role') + ']' : '') + ` ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} ${pos !== 'static' ? pos : ''} ${ov !== 'visible' ? 'ov=' + ov : ''} z=${cs.zIndex} | ${cls}`);
      if (el.tagName === 'svg') return;
      for (const c of el.children) walk(c, depth + 1);
    }
    walk(d, 0);
    return lines.slice(0, 120).join('\n');
  });
  console.log(out);
  console.log(errors.join('\n'));
  await browser.close();
})();
