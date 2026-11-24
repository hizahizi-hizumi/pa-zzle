const { open, tab, G } = require('./lib');
const mode = process.argv[2] || 'phone';
(async () => {
  const { browser, page } = await open(mode);
  const res = {};
  for (const name of ['ルール', '操作', '採点']) {
    await tab(page, name);
    res[name] = await page.evaluate(() => {
      const p = [...document.querySelectorAll('[role=tabpanel]')].find(e => e.getAttribute('data-state') === 'active');
      const out = [];
      const seen = new Set();
      const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) {
        const t = n.textContent.trim(); if (!t) continue;
        let el = n.parentElement;
        // climb to block-ish element
        while (el && getComputedStyle(el).display === 'inline-block' || el && getComputedStyle(el).display === 'inline') el = el.parentElement;
        if (seen.has(el)) continue; seen.add(el);
        const cs = getComputedStyle(n.parentElement);
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        out.push(`${el.tagName.toLowerCase()} fs=${cs.fontSize} fw=${cs.fontWeight} lh=${cs.lineHeight} col=${cs.color} x=${r.x.toFixed(1)} w=${r.width.toFixed(1)} y=${r.y.toFixed(0)} :: ${el.innerText.replace(/\n/g, '⏎').slice(0, 50)}`);
      }
      return out;
    });
  }
  // header / description
  res.header = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const h = d.querySelector('h2');
    const cs = getComputedStyle(h);
    const desc = [...d.querySelectorAll('p')].map(p => { const c = getComputedStyle(p); const r = p.getBoundingClientRect(); return `p fs=${c.fontSize} fw=${c.fontWeight} x=${r.x} y=${r.y} :: ${p.innerText.slice(0, 30)}`; });
    const tabs = [...d.querySelectorAll('[role=tab]')].map(t => { const c = getComputedStyle(t); const r = t.getBoundingClientRect(); return `tab fs=${c.fontSize} fw=${c.fontWeight} x=${r.x} w=${r.width} :: ${t.innerText}`; });
    return [`h2 fs=${cs.fontSize} fw=${cs.fontWeight}`, ...desc, ...tabs];
  });
  require('fs').writeFileSync(`${G}/${mode}-typo.txt`, Object.entries(res).map(([k, v]) => `## ${k}\n` + v.join('\n')).join('\n\n'));
  await browser.close();
})();
