const L = require('./lib');
(async () => {
  const browser = await L.chromium.launch();
  for (const v of ['before', 'after']) {
    const { page } = await L.openHelp(v, 'phone', 'bridges', browser);
    await page.waitForTimeout(3000);
    const panel = (await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]'))[0];
    await panel.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const fig = await panel.$('figure');
    const b = await (await fig.$(':scope > *')).boundingBox();
    console.log(v, 'fig child box', b);
    await page.mouse.click(b.x + b.width * 0.75, b.y + b.width * 0.5);
    await page.waitForTimeout(900);
    const pb = await panel.boundingBox();
    await page.screenshot({ path: L.OUT + '/bridges-touch-' + v + '.png', clip: { x: 0, y: pb.y - 60, width: 390, height: pb.height + 80 } });
    const info = await panel.evaluate(p => { const r = p.querySelector('button[aria-label="例を元に戻す"]'); return { placement: p.getAttribute('data-reset-button-placement'), enabled: !r.disabled }; });
    console.log(v, info);
    await page.context().close();
  }
  await browser.close();
})();
