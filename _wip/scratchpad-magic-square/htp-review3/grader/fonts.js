const { openHelp, OUT } = require('./lib');
(async () => {
  for (const kind of ['sp', 'pc']) {
    const { browser, page } = await openHelp(kind, { wait: 1500 });
    const res = [];
    for (const tab of ['ルール', '操作', '採点']) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(300);
      const r = await page.evaluate((tab) => {
        const dlg = document.querySelector('[role=dialog]');
        const panel = dlg.querySelector('[role=tabpanel][data-state=active]');
        const seen = new Map();
        const els = [...dlg.querySelectorAll('h1,h2,h3,h4,p,figcaption,[role=tab],dt,dd,li span,span,div')].filter(e => {
          if (e.closest('[role=tabpanel]') && e.closest('[role=tabpanel]') !== panel) return false;
          const direct = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          return direct;
        });
        const out = [];
        for (const e of els) {
          const cs = getComputedStyle(e);
          if (cs.visibility === 'hidden') continue;
          const key = cs.fontSize + '/' + cs.fontWeight + '/' + cs.color + '/' + (e.closest('h3,h4,p,figcaption,button,[role=tab]')?.tagName || '');
          const txt = e.textContent.trim().slice(0, 14);
          if (!seen.has(key)) { seen.set(key, []); }
          if (seen.get(key).length < 3) seen.get(key).push(txt);
        }
        for (const [k, v] of seen) out.push(k + '  ' + v.join(' | '));
        return out;
      }, tab);
      res.push('== ' + tab, ...r);
    }
    console.log('#### ' + kind + '\n' + res.join('\n'));
    await browser.close();
  }
})();
