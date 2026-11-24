// Scroll through every tab in steps, screenshot each step
const { open, setScroll, tab, G } = require('./lib');
(async () => {
  const mode = process.argv[2] || 'phone';
  const step = Number(process.argv[3] || 600);
  const { browser, page, errors } = await open(mode);
  for (const [i, name] of [['r', 'ルール'], ['o', '操作'], ['s', '採点']]) {
    await tab(page, name);
    let y = 0; let n = 0;
    while (true) {
      const st = await setScroll(page, y);
      await page.screenshot({ path: `${G}/${mode}-scan-${i}-${String(n).padStart(2, '0')}.png` });
      n++;
      if (st.top + st.ch >= st.h - 1) { console.log(name, 'scrollHeight', st.h, 'client', st.ch, 'shots', n); break; }
      y += step;
    }
  }
  console.log(errors.join('\n'));
  await browser.close();
})();
