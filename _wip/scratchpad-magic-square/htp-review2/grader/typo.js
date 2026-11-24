const { openHelp } = require('./lib');
(async () => {
  const kind = process.argv[2] || 'sp';
  const { browser, page } = await openHelp(kind === 'sp' ? 'sptall' : 'pc', { height: 3000 });
  await page.waitForTimeout(4500);
  const dump = async (label) => {
    const rows = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      const seen = new Map();
      const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (!t) continue;
        const el = node.parentElement;
        if (el.closest('.sr-only') || el.closest('[aria-hidden=true] .sr-only')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        const cs = getComputedStyle(el);
        const inPanel = el.closest('[role=tabpanel]');
        if (inPanel && inPanel.getAttribute('data-state') !== 'active') continue;
        const key = `${cs.fontSize}/${cs.lineHeight}/${cs.fontWeight}/${cs.color}`;
        const sample = t.slice(0, 14);
        if (!seen.has(key)) seen.set(key, []);
        const arr = seen.get(key); if (arr.length < 6 && !arr.includes(sample)) arr.push(sample);
      }
      return Array.from(seen.entries()).map(([k, v]) => k + '  ::  ' + v.join(' | '));
    });
    console.log('== ' + label); console.log(rows.join('\n'));
  };
  await dump('ルール');
  await page.getByRole('tab', { name: '操作' }).click(); await page.waitForTimeout(400); await dump('操作');
  await page.getByRole('tab', { name: '採点' }).click(); await page.waitForTimeout(400); await dump('採点');
  await browser.close();
})();
