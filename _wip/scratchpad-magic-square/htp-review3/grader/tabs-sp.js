const { openHelp, scrollInfo, setScroll, OUT } = require('./lib');
(async () => {
  const kind = process.argv[2] || 'sp';
  const step = kind === 'sp' ? 500 : 650;
  const { browser, page, errs } = await openHelp(kind);
  for (const tab of ['ルール', '操作', '採点']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(600);
    const info = await scrollInfo(page);
    console.log(tab, JSON.stringify(info));
    const max = info ? info.sh - info.ch : 0;
    let i = 0;
    for (let y = 0; ; y += step) {
      const yy = Math.min(y, max);
      if (info) await setScroll(page, yy);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}${kind}-tab-${tab}-${String(i).padStart(2, '0')}.png` });
      i++;
      if (yy >= max) break;
    }
    if (info) await setScroll(page, 0);
  }
  console.log(errs.join('\n'));
  await browser.close();
})();
