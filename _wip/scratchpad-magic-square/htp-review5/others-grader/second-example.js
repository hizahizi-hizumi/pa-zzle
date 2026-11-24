// Press the hint in the LAST figure of a rules panel, then screenshot the viewport as the player would see it.
// usage: node second-example.js <game> <dev> <panelIdx>
const L = require('./lib');
const [game, dev, idxS] = process.argv.slice(2);
(async () => {
  const browser = await L.chromium.launch();
  for (const v of ['before', 'after']) {
    const { page } = await L.openHelp(v, dev, game, browser);
    await page.waitForTimeout(3000);
    const p = (await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]'))[+idxS];
    const figs = await p.$$('figure');
    const last = figs[figs.length - 1];
    await last.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    const hint = await last.$('[data-how-to-play-press-hint]');
    let pressed = false;
    if (hint) {
      const hb = await hint.boundingBox();
      await page.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2);
      pressed = true;
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: L.OUT + '/second-' + game + '-' + dev + '-p' + idxS + '-' + v + '.png' });
    const info = await p.evaluate(el => {
      const r = el.querySelector('button[aria-label="例を元に戻す"]');
      const b = r.getBoundingClientRect();
      return { enabled: !r.disabled, buttonTop: Math.round(b.top), buttonBottom: Math.round(b.bottom), vh: window.innerHeight };
    });
    console.log(v, 'pressed', pressed, JSON.stringify(info));
    await page.context().close();
  }
  await browser.close();
})();
