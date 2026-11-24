const L = require('./lib');
const [v, dev] = process.argv.slice(2);
(async () => {
  const browser = await L.chromium.launch();
  const { page } = await L.openHelp(v, dev, 'tsume-shogi', browser);
  await page.waitForTimeout(3000);
  const panels = await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]');
  const p = panels[6];
  const heading = await p.evaluate(el => el.closest('section').querySelector('h3,h4').textContent);
  console.log('heading', heading);
  await p.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  for (let round = 0; round < 4; round++) {
    const hint = await p.$('[data-how-to-play-press-hint]');
    if (!hint) { console.log('no hint'); break; }
    const hb = await hint.boundingBox();
    const x = hb.x + hb.width / 2, y = hb.y + hb.height / 2;
    const at = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? el.tagName + ' ' + (el.getAttribute('aria-label') || '') + ' inDialog=' + !!el.closest('[role=dialog]') : 'none'; }, [x, y]);
    console.log('round', round, 'hint', Math.round(x), Math.round(y), 'element at point:', at);
    await page.screenshot({ path: L.OUT + '/tsume-p6-' + v + '-' + dev + '-r' + round + '.png' });
    await page.mouse.click(x, y);
    await page.waitForTimeout(1000);
    const open = await page.$('[role=dialog]');
    console.log('dialog open after click:', !!open);
    if (!open) break;
  }
  await browser.close();
})();
