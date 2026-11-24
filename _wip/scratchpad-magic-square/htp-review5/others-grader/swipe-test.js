// usage: node swipe-test.js <game> <dev> <tab> <panelIdx> <dx> <dy> [figIdx]
const L = require('./lib');
const [game, dev, tab, idxS, dxS, dyS, figS] = process.argv.slice(2);
const idx = +idxS, dx = +dxS, dy = +dyS, figIdx = +(figS || 0);
const labels = { rules: 'ルール', operations: '操作', scoring: '採点' };
(async () => {
  const browser = await L.chromium.launch();
  for (const v of ['before', 'after']) {
    const { page } = await L.openHelp(v, dev, game, browser);
    await page.waitForTimeout(2500);
    await page.getByRole('tab', { name: labels[tab] }).click();
    await page.waitForTimeout(500);
    const panel = (await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]'))[idx];
    { const f = (await panel.$$('figure'))[figIdx]; await f.evaluate(el => el.scrollIntoView({ block: 'center' })); }
    await page.waitForTimeout(300);
    const hints = await panel.$$('[data-how-to-play-press-hint]');
    let start;
    if (hints[figIdx]) { const hb = await hints[figIdx].boundingBox(); start = { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }; }
    else { const f = (await panel.$$('figure'))[figIdx]; const fb = await f.boundingBox(); start = { x: fb.x + fb.width / 2, y: fb.y + fb.height / 3 }; }
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(start.x + dx * i / 8, start.y + dy * i / 8); await page.waitForTimeout(20); }
    await page.mouse.up();
    await page.waitForTimeout(1500);
    const pb = await panel.boundingBox();
    const vp = page.viewportSize();
    const y = Math.max(0, pb.y - 60);
    await page.screenshot({ path: L.OUT + '/swipe-' + game + '-' + dev + '-' + tab + idx + '-' + v + '.png', clip: { x: Math.max(0, pb.x - 8), y, width: Math.min(vp.width - Math.max(0, pb.x - 8), pb.width + 16), height: Math.min(vp.height - y, pb.height + 80) } });
    const info = await panel.evaluate(p => { const r = p.querySelector('button[aria-label="例を元に戻す"]'); const pr = p.getBoundingClientRect(); const b = r.getBoundingClientRect(); return { placement: p.getAttribute('data-reset-button-placement'), enabled: !r.disabled, top: Math.round(b.top - pr.top), bottom: Math.round(pr.bottom - b.bottom), right: Math.round(pr.right - b.right), vpTop: Math.round(b.top) }; });
    console.log(v, JSON.stringify(info));
    await page.context().close();
  }
  await browser.close();
})();
