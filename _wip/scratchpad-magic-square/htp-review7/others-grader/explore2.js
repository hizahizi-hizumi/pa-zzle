const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [port, game] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/puzzles/${game}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(400);
  console.log(await page.getByRole('menuitem').allInnerTexts());
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => {
    const dlg = document.querySelector('[role=dialog]');
    const panels = [...dlg.querySelectorAll('[data-reset-button-placement]')].map(p => ({place: p.dataset.resetButtonPlacement, figs: p.querySelectorAll('figure').length, btns: [...p.querySelectorAll('button,[role=button],[aria-label]')].slice(0,8).map(b=>b.tagName+':'+(b.getAttribute('aria-label')||b.textContent.slice(0,20)))}));
    const tabs = [...dlg.querySelectorAll('[role=tab]')].map(t=>t.textContent);
    return { tabs, panels, h: [...dlg.querySelectorAll('h2,h3,h4')].map(h=>h.tagName+':'+h.textContent.slice(0,40)) };
  });
  console.log(JSON.stringify(info, null, 1));
  await page.screenshot({ path: 'x.png' });
  await browser.close();
})();
