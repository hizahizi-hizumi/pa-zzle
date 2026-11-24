// PC: open, screenshot each tab; right column scroll in steps
const { open, tab, G } = require('./lib');
(async () => {
  const { browser, page, errors } = await open('pc');
  await page.screenshot({ path: `${G}/pc-00-open.png` });
  for (const [i, name] of [['r', 'ルール'], ['o', '操作'], ['s', '採点']]) {
    await tab(page, name);
    // find the scrollable tab panel
    let n = 0; let y = 0;
    while (true) {
      const st = await page.evaluate((y) => {
        const p = [...document.querySelectorAll('[role=tabpanel]')].find(e => e.getAttribute('data-state') === 'active');
        p.scrollTop = y; return { top: p.scrollTop, h: p.scrollHeight, ch: p.clientHeight };
      }, y);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${G}/pc-scan-${i}-${String(n).padStart(2, '0')}.png` });
      n++;
      if (st.top + st.ch >= st.h - 1) { console.log(name, st); break; }
      y += st.ch - 80;
    }
  }
  console.log(errors.join('\n'));
  await browser.close();
})();
