// Fine scroll on phone: capture top area (header+tabs+~250px) at small steps to inspect overlap with sticky tabs
const { open, setScroll, tab, G } = require('./lib');
const fs = require('fs');
(async () => {
  const { browser, page, errors } = await open('phone');
  fs.mkdirSync(`${G}/fine`, { recursive: true });
  for (const [i, name] of [['r', 'ルール'], ['o', '操作'], ['s', '採点']]) {
    await tab(page, name);
    let y = 0; let n = 0;
    while (true) {
      const st = await setScroll(page, y);
      await page.screenshot({ path: `${G}/fine/${i}-${String(n).padStart(3, '0')}-y${st.top}.png`, clip: { x: 0, y: 0, width: 390, height: 260 } });
      n++;
      if (st.top + st.ch >= st.h - 1) break;
      y += 37;
    }
    console.log(name, n);
  }
  console.log(errors.join('\n'));
  await browser.close();
})();
