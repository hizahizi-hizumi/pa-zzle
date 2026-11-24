const { openHelp } = require('./lib');
const { panels, shotPanel, hintCenter, verdictText, resetVisible } = require('./lib2');
(async () => {
  const kind = process.argv[2] || 'sp';
  const tab = process.argv[3] || 'ルール';
  const { browser, page, errs } = await openHelp(kind, { wait: 1200 });
  await page.getByRole('tab', { name: tab }).click();
  await page.waitForTimeout(400);
  const ps = await panels(page);
  console.log('panels', ps.length);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    await p.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shotPanel(page, p, `${kind}-${tab}-p${i}-s0`, 0);
    console.log(`p${i} s0 verdict:`, await verdictText(p), 'hints', JSON.stringify(await hintCenter(p)), 'reset', await resetVisible(p));
    for (let s = 1; s <= 6; s++) {
      const hs = await hintCenter(p);
      if (!hs.length) break;
      await page.mouse.click(hs[0].x, hs[0].y);
      await page.waitForTimeout(120);
      await shotPanel(page, p, `${kind}-${tab}-p${i}-s${s}-120ms`, 0);
      await page.waitForTimeout(900);
      await shotPanel(page, p, `${kind}-${tab}-p${i}-s${s}`, 0);
      console.log(`p${i} s${s} verdict:`, await verdictText(p), 'hints', JSON.stringify(await hintCenter(p)), 'reset', await resetVisible(p));
    }
  }
  console.log(errs.join('\n'));
  await browser.close();
})();
