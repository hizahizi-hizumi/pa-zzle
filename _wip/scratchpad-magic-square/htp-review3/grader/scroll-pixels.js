const { openHelp, scrollInfo, setScroll, OUT } = require('./lib');
const fs = require('fs');
(async () => {
  const kind = process.argv[2] || 'sp';
  const step = +(process.argv[3] || 17);
  const { browser, page, errs } = await openHelp(kind);
  const tl = await page.evaluate(() => { const r = document.querySelector('[role=tablist]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom }; });
  const vw = page.viewportSize().width;
  const dir = OUT + `scrollseq-${kind}/`;
  fs.mkdirSync(dir, { recursive: true });
  for (const tab of ['ルール', '操作', '採点']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(500);
    const info = await scrollInfo(page);
    const max = info.sh - info.ch;
    let i = 0;
    for (let y = 0; y <= max + step; y += step) {
      await setScroll(page, Math.min(y, max));
      await page.waitForTimeout(40);
      await page.screenshot({ path: `${dir}${tab}-${String(i).padStart(3, '0')}.png`, clip: { x: 0, y: 0, width: vw, height: tl.b + 40 } });
      i++;
    }
    await setScroll(page, 0);
  }
  console.log(errs.join('\n'));
  await browser.close();
})();
