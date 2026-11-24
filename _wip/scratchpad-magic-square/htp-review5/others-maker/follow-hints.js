// Follow press hints inside one example and film the panel while the move animates.
// usage: node follow-hints.js <version> <dev> <game> <tab> <panelIndex> <figIndex> <clicks> [tag]
const fs = require('fs');
const path = require('path');
const { chromium, ROOT, openHelp, waitGoalDone } = require('./lib');
const TABS = { rules: 'ルール', operations: '操作', scoring: '採点' };

(async () => {
  const [version, dev, game, tab, pi, fi, clicks, tag = ''] = process.argv.slice(2);
  const dir = path.join(ROOT, 'shots', game, 'follow');
  fs.mkdirSync(dir, { recursive: true });
  const prefix = path.join(dir, `${version}-${dev}-${tab}-p${pi}-f${fi}${tag}`);
  const browser = await chromium.launch();
  const { page, errors } = await openHelp(browser, version, dev, game);
  await waitGoalDone(page);
  await page.getByRole('tab', { name: TABS[tab] }).click();
  await page.waitForTimeout(500);
  const panels = await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]');
  const visible = [];
  for (const p of panels) if (await p.evaluate((el) => el.getBoundingClientRect().width > 0)) visible.push(p);
  const p = visible[Number(pi)];
  await p.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const clipOf = async () => {
    const r = await p.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    const vp = page.viewportSize();
    const x = Math.max(0, r.x - 10), y = Math.max(0, r.y - 60);
    return { x, y, width: Math.min(vp.width - x, r.w + 20), height: Math.min(vp.height - y, r.h + 80) };
  };
  const clip = await clipOf();
  await page.screenshot({ path: `${prefix}-00.png`, clip });
  let frame = 1;
  const log = [];
  for (let c = 0; c < Number(clicks); c++) {
    const pt = await p.evaluate((el, fi) => {
      const f = el.querySelectorAll('figure')[fi];
      const h = [...f.querySelectorAll('[data-how-to-play-press-hint]')].find((x) => x.getBoundingClientRect().width > 0);
      if (!h) return null;
      const r = h.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, Number(fi));
    if (!pt) { log.push(`click ${c}: no hint`); break; }
    await page.mouse.click(pt.x, pt.y);
    log.push(`click ${c} at ${Math.round(pt.x)},${Math.round(pt.y)}`);
    const n = c === Number(clicks) - 1 ? 14 : 3;
    for (let k = 0; k < n; k++) {
      await page.waitForTimeout(110);
      await page.screenshot({ path: `${prefix}-${String(frame).padStart(2, '0')}.png`, clip });
      frame++;
    }
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${prefix}-${String(frame).padStart(2, '0')}-end.png`, clip: await clipOf() });
  const st = await p.evaluate((el) => {
    const s = el.querySelector(':scope > span.absolute');
    const b = s.querySelector('button').getBoundingClientRect();
    return { placement: el.getAttribute('data-reset-button-placement'), visible: !s.querySelector('span').classList.contains('invisible'), btn: [b.x, b.y, b.right, b.bottom].map(Math.round) };
  });
  log.push(JSON.stringify(st));
  log.push('errors ' + JSON.stringify(errors));
  fs.writeFileSync(`${prefix}-log.txt`, log.join('\n'));
  console.log(log.join('\n'));
  await browser.close();
})();
