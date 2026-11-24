const { openHelp } = require('./lib');
const [kind, outdir, h] = process.argv.slice(2);
const fs = require('fs'); fs.mkdirSync(outdir, { recursive: true });
(async () => {
  const { browser, page, errors } = await openHelp(kind, { height: Number(h || 3200), dsf: 2 });
  await page.waitForTimeout(6000);
  for (const tab of ['ルール', '操作', '採点']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${outdir}/tab-${tab}.png` });
    const panel = page.locator('[role=tabpanel][data-state=active]');
    const n = await panel.locator(':scope > div > section').count();
    for (let i = 0; i < n; i++) {
      await panel.locator(':scope > div > section').nth(i).screenshot({ path: `${outdir}/${tab}-${i}.png` });
    }
  }
  console.log(errors.join('\n'));
  await browser.close();
})();
