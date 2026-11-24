const { open, tab, G } = require('./lib');
(async () => {
  const { browser, page } = await open('phone');
  const out = await page.evaluate(() => {
    const p = [...document.querySelectorAll('[role=tabpanel]')].find(e => e.getAttribute('data-state') === 'active');
    const walk = (el, d) => {
      if (d > 9) return '';
      let s = '  '.repeat(d) + el.tagName.toLowerCase() + (el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : '') + (el.getAttribute('aria-label') ? `[aria=${el.getAttribute('aria-label')}]` : '') + ' .' + (el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 120) : '') + '\n';
      for (const c of el.children) s += walk(c, d + 1);
      return s;
    };
    return walk(p, 0);
  });
  require('fs').writeFileSync(`${G}/dom-rules.txt`, out);
  await browser.close();
})();
