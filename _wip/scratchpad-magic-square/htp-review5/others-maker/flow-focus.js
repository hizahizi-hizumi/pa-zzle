// Count focusable elements inside the scoring-tab flow figures (pre-existing check for "押せない図は inert").
const { chromium, openHelp, waitGoalDone } = require('./lib');
(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const game of process.argv.slice(2)) {
    const { ctx, page } = await openHelp(browser, 'after', 'pc', game);
    await waitGoalDone(page, 12000);
    await page.getByRole('tab', { name: '採点' }).click();
    await page.waitForTimeout(400);
    out[game] = await page.evaluate(() => {
      const panel = document.querySelector('[role=tabpanel][data-state=active]');
      return [...panel.querySelectorAll('div.rounded-lg.border')].filter((d) => d.querySelector('figure')).map((d) => {
        const f = [...d.querySelectorAll('button, a[href], input, [tabindex]')].filter((e) => e.getAttribute('tabindex') !== '-1' && !e.closest('[inert]') && !e.disabled);
        return { inert: d.closest('[inert]') !== null, focusable: f.length, sample: f.slice(0, 2).map((e) => e.tagName + ':' + (e.getAttribute('aria-label') || '')) };
      });
    });
    await ctx.close();
  }
  console.log(JSON.stringify(out));
  await browser.close();
})();
