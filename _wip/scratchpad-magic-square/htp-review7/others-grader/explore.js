const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [port, game] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${port}/puzzles/${game}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const bodyText = (await page.locator('body').innerText()).slice(0, 500);
  console.log('BODY', bodyText.replace(/\n/g, ' | '));
  const btns = await page.locator('button').allInnerTexts();
  console.log('BUTTONS', btns.slice(0, 30));
  await browser.close();
  console.log('ERR', errors.slice(0,5));
})();
