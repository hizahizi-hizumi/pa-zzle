const { openHelp, OUT } = require('./lib');
const { panels, shotPanel, hintCenter } = require('./lib2');
(async () => {
  // PC: follow first hints on rule tab + hover
  {
    const { browser, page, errs } = await openHelp('pc', { wait: 1200 });
    const ps = await panels(page);
    const p = ps[0];
    const hs = await hintCenter(p);
    await page.mouse.move(hs[0].x, hs[0].y);
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + 'pc-hover-rule1.png' });
    const cursor = await page.evaluate(({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)).cursor, hs[0]);
    console.log('cursor over cell', cursor);
    await page.mouse.click(hs[0].x, hs[0].y);
    await page.waitForTimeout(500);
    const hs2 = await hintCenter(p);
    await page.mouse.click(hs2[0].x, hs2[0].y);
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT + 'pc-rule1-after.png' });
    // switch tabs and come back
    await page.getByRole('tab', { name: '操作' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('tab', { name: 'ルール' }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: OUT + 'pc-rule1-after-tabback.png' });
    // ops tab follow first two
    await page.getByRole('tab', { name: '操作' }).click();
    await page.waitForTimeout(400);
    const ops = await panels(page);
    const o = ops[2];
    await o.scrollIntoViewIfNeeded();
    for (let i = 0; i < 2; i++) { const h = await hintCenter(o); if (!h.length) break; await page.mouse.click(h[0].x, h[0].y); await page.waitForTimeout(500); }
    await page.screenshot({ path: OUT + 'pc-op-memo-mid.png' });
    console.log(errs.join('\n'));
    await browser.close();
  }
  // SP reduced motion open sequence
  {
    const { browser, page, errs } = await openHelp('sp', { wait: 0, reducedMotion: true });
    const t0 = Date.now();
    for (const t of [100, 500, 900, 1500]) { const w = t - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w); await page.screenshot({ path: OUT + `sp-rm-open-${t}.png` }); }
    console.log(errs.join('\n'));
    await browser.close();
  }
  // SP: close and reopen keeps/reset state?
  {
    const { browser, page, errs } = await openHelp('sp', { wait: 1500 });
    await page.getByRole('tab', { name: '採点' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '閉じる' }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: OUT + 'sp-after-close.png' });
    await page.getByRole('button', { name: 'メニュー' }).click();
    await page.waitForTimeout(300);
    await page.getByText('遊び方', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + 'sp-reopen-300.png' });
    console.log(errs.join('\n'));
    await browser.close();
  }
})();
