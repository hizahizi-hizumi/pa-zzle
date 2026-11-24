// usage: node scroll.js sp|pc tabName step prefix
const { openHelp } = require('./lib');
const [kind, tab, stepS, prefix] = process.argv.slice(2);
const step = Number(stepS);
(async () => {
  const { browser, page, errors } = await openHelp(kind);
  await page.waitForTimeout(6000); // let goal playback finish
  if (tab !== 'ルール') { await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(600); }
  const sc = kind === 'pc' ? page.locator('[role=tabpanel][data-state=active]') : page.locator('[role=dialog] .overflow-y-auto').first();
  const total = await sc.evaluate(e => e.scrollHeight - e.clientHeight);
  console.log('scrollable', total);
  let i = 0;
  for (let y = 0; y <= total + step - 1; y += step) {
    const yy = Math.min(y, total);
    await sc.evaluate((e, v) => { e.scrollTop = v; }, yy);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${prefix}-${String(i).padStart(2, '0')}.png` });
    i++;
    if (yy === total) break;
  }
  console.log('shots', i);
  console.log(errors.join('\n'));
  await browser.close();
})();
