// node sections.js sp|pc outdir
const { openHelp } = require('./lib');
const [kind, outdir] = process.argv.slice(2);
const fs = require('fs'); fs.mkdirSync(outdir, { recursive: true });
(async () => {
  const { browser, page, errors } = await openHelp(kind);
  await page.waitForTimeout(6000);
  for (const tab of ['ルール', '操作', '採点']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(700);
    const panel = page.locator('[role=tabpanel][data-state=active]');
    const n = await panel.locator(':scope > div > section').count();
    for (let i = 0; i < n; i++) {
      const s = panel.locator(':scope > div > section').nth(i);
      await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await s.screenshot({ path: `${outdir}/${tab}-${i}.png` });
    }
    console.log(tab, n);
  }
  console.log(errors.join('\n'));
  await browser.close();
})();
