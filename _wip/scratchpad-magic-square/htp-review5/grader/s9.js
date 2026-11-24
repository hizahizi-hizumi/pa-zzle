const { open, tab, G } = require('./lib');
(async () => {
  const { browser, page } = await open('phone');
  const ps = page.locator('[role=tabpanel][data-state=active] div.rounded-lg.bg-muted');
  const p = ps.nth(2); await p.scrollIntoViewIfNeeded();
  await p.getByRole('button', { name: /^1行1列/ }).tap();
  await page.waitForTimeout(300);
  const six = p.getByRole('button', { name: '6', exact: true });
  await six.tap();
  for (let i = 0; i < 8; i++) { await p.screenshot({ path: `${G}/shake/given-${i}.png` }); await page.waitForTimeout(40); }
  // also press given cell "4" then 6
  // flow figure press test
  await page.getByRole('tab', { name: '採点' }).click();
  await page.waitForTimeout(300);
  const fig = page.locator('[role=tabpanel][data-state=active] figure').first();
  console.log('figures in scoring', await page.locator('[role=tabpanel][data-state=active] figure').count());
  const btns = await page.locator('[role=tabpanel][data-state=active]').getByRole('button').count();
  console.log('buttons in scoring tab', btns);
  // tutorial button
  await page.getByRole('tab', { name: 'ルール' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /チュートリアル/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${G}/tutorial-open.png` });
  await browser.close();
})();
