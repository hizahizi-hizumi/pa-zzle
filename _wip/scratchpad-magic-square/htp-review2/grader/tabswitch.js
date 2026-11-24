const { openHelp } = require('./lib');
(async () => {
  const { browser, page } = await openHelp('sp');
  await page.waitForTimeout(4500);
  const sc = page.locator('[role=dialog] .overflow-y-auto').first();
  await page.screenshot({ path: 'tabswitch/0-rule-top.png' });
  await page.getByRole('tab', { name: '操作' }).tap(); await page.waitForTimeout(700);
  console.log('after 操作 tap scrollTop', await sc.evaluate(e => e.scrollTop));
  await page.screenshot({ path: 'tabswitch/1-ops-after-tap.png' });
  // scroll mid, then switch tabs
  await sc.evaluate(e => { e.scrollTop = 900; }); await page.waitForTimeout(300);
  await page.screenshot({ path: 'tabswitch/2-ops-mid.png' });
  await page.getByRole('tab', { name: '採点' }).tap(); await page.waitForTimeout(700);
  console.log('after 採点 tap scrollTop', await sc.evaluate(e => e.scrollTop));
  await page.screenshot({ path: 'tabswitch/3-score-after-tap.png' });
  await page.getByRole('tab', { name: 'ルール' }).tap(); await page.waitForTimeout(700);
  console.log('after ルール tap scrollTop', await sc.evaluate(e => e.scrollTop));
  await page.screenshot({ path: 'tabswitch/4-rule-after-tap.png' });
  await browser.close();
})();
