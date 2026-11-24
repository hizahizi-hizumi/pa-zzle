const L = require('./lib');
(async () => {
  const browser = await L.chromium.launch();
  for (const dev of ['phone', 'pc']) {
    const ctx = await browser.newContext(dev === 'phone' ? { ...L.devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(L.BASES.after + '/puzzles/water-sort', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /ランダムに遊ぶ/ }).first().click().catch(e => console.log('no random', e.message.split('\n')[0]));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${L.OUT}/play-${dev}.png` });
    const btns = await page.locator('header button, button[aria-label]').evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect(); return `${(b.getAttribute('aria-label') || b.textContent).trim().slice(0,20)}@${Math.round(r.x)},${Math.round(r.y)}`; }));
    console.log(dev, btns.slice(0, 15).join(' | '));
    await ctx.close();
  }
  await browser.close();
})();
