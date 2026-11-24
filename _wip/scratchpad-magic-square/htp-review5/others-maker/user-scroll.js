// Scroll like a reader so one example (figure) and its caption sit fully in view, touch its hint, and shoot the viewport.
// usage: node user-scroll.js <version> <dev> <game> <tab> <panelIndex> <figIndex> <align: bottom|top>
const fs = require('fs');
const path = require('path');
const { chromium, ROOT, openHelp, waitGoalDone, scrollerHandle } = require('./lib');
const TABS = { rules: 'ルール', operations: '操作', scoring: '採点' };

(async () => {
  const [version, dev, game, tab, pi, fi, align] = process.argv.slice(2);
  const dir = path.join(ROOT, 'shots', game, 'user-scroll');
  fs.mkdirSync(dir, { recursive: true });
  const prefix = path.join(dir, `${version}-${dev}-${tab}-p${pi}-f${fi}-${align}`);
  const browser = await chromium.launch();
  const { page } = await openHelp(browser, version, dev, game);
  await waitGoalDone(page);
  await page.getByRole('tab', { name: TABS[tab] }).click();
  await page.waitForTimeout(500);
  const panels = await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]');
  const visible = [];
  for (const p of panels) if (await p.evaluate((el) => el.getBoundingClientRect().width > 0)) visible.push(p);
  const p = visible[Number(pi)];
  const h = await scrollerHandle(page);
  // put the figure's bottom 12px above the viewport bottom, or its top 12px below the sticky tab row
  await h.evaluate((sc, args) => {
    const [panelIdx, figIdx, align] = args;
    const panels = [...document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')].filter((el) => el.getBoundingClientRect().width > 0);
    const fig = panels[panelIdx].querySelectorAll('figure')[figIdx];
    const sr = sc.getBoundingClientRect();
    const fr = fig.getBoundingClientRect();
    const visibleBottom = Math.min(sr.bottom, window.innerHeight);
    if (align === 'bottom') sc.scrollTop += fr.bottom - (visibleBottom - 12);
    else sc.scrollTop += fr.top - (sr.top + 44 + 12);
  }, [Number(pi), Number(fi), align]);
  await page.waitForTimeout(400);
  let pt = null;
  for (let c = 0; c < Number(process.env.CLICKS || 2); c++) {
    const q = await p.evaluate((el, fi) => {
      const f = el.querySelectorAll('figure')[fi];
      const hint = [...f.querySelectorAll('[data-how-to-play-press-hint]')].find((x) => x.getBoundingClientRect().width > 0);
      if (!hint) return null;
      const r = hint.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, Number(fi));
    if (!q) break;
    pt = q;
    await page.mouse.click(q.x, q.y);
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${prefix}.png` });
  const st = await p.evaluate((el) => {
    const s = el.querySelector(':scope > span.absolute');
    const b = s.querySelector('button').getBoundingClientRect();
    return { placement: el.getAttribute('data-reset-button-placement'), visible: !s.querySelector('span').classList.contains('invisible'), btnTop: Math.round(b.top), btnBottom: Math.round(b.bottom) };
  });
  const sc = await h.evaluate((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(Math.min(r.bottom, window.innerHeight)) }; });
  const inView = st.btnTop >= sc.top + 44 && st.btnBottom <= sc.bottom;
  const line = `${path.basename(prefix)} touch=${JSON.stringify(pt)} btn=${JSON.stringify(st)} scroller=${JSON.stringify(sc)} buttonInView=${inView}`;
  fs.writeFileSync(`${prefix}-log.txt`, line);
  console.log(line);
  await browser.close();
})();
