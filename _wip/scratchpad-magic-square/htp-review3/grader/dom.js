const { openHelp, OUT } = require('./lib');
(async () => {
  const { browser, page } = await openHelp('sp', { wait: 1500 });
  const s = await page.evaluate(() => {
    const panel = document.querySelector('[role=tabpanel][data-state=active]');
    function walk(e, depth) {
      if (depth > 7) return '';
      let out = '';
      for (const c of e.children) {
        const r = c.getBoundingClientRect();
        const attrs = [...c.attributes].filter(a => a.name.startsWith('data-') || a.name === 'role' || a.name === 'aria-label').map(a => a.name + '=' + a.value.slice(0, 20)).join(' ');
        out += '  '.repeat(depth) + c.tagName + ' ' + attrs + ' [' + (c.className && c.className.toString ? c.className.toString().slice(0, 50) : '') + '] ' + Math.round(r.y) + ' h' + Math.round(r.height) + '\n';
        if (c.tagName !== 'BUTTON' && c.tagName !== 'svg') out += walk(c, depth + 1);
      }
      return out;
    }
    return walk(panel, 0);
  });
  console.log(s.split('\n').slice(0, 140).join('\n'));
  await browser.close();
})();
