// 触った後の動きの途中で、元に戻すボタンと盤面の物が重ならないかをコマ撮りで確かめる。
// usage: node frames.js <before|after> <phone|w320|pc> <game> <rules|operations> <panel> <figure> <taps>
//   taps: 手がかりを順に押す回数（手がかりが無くなったら止める）
const fs = require('fs');
const path = require('path');
const { chromium, ROOT, openHelp, waitGoalDone, stickyBottom } = require('./lib');
const TABS = { rules: 'ルール', operations: '操作' };

(async () => {
  const [version, dev, game, tab, pi, fi, taps] = process.argv.slice(2);
  const dir = path.join(ROOT, 'shots', game, 'frames');
  fs.mkdirSync(dir, { recursive: true });
  const prefix = path.join(dir, `${version}-${dev}-${tab}-p${pi}-f${fi}`);
  const browser = await chromium.launch();
  const { page } = await openHelp(browser, version, dev, game);
  await waitGoalDone(page);
  await page.getByRole('tab', { name: TABS[tab] }).click();
  await page.waitForTimeout(500);
  const sticky = dev === 'pc' ? 0 : await stickyBottom(page);
  const panels = [];
  for (const p of await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]')) {
    if (await p.evaluate((el) => el.getBoundingClientRect().width > 0)) panels.push(p);
  }
  const p = panels[Number(pi)];
  await p.evaluate((el, args) => {
    const [fi, sticky] = args;
    const f = el.querySelectorAll('figure')[fi];
    let sc = f.parentElement;
    while (sc && sc !== document.body) {
      const cs = getComputedStyle(sc);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 2) break;
      sc = sc.parentElement;
    }
    if (!sc || sc === document.body) sc = document.scrollingElement;
    const r = el.getBoundingClientRect();
    sc.scrollTop += r.top - (sticky + 16);
  }, [Number(fi), sticky]);
  await page.waitForTimeout(400);
  const lines = [];
  let frame = 0;
  for (let t = 0; t < Number(taps); t++) {
    const q = await p.evaluate((el, fi) => {
      const f = el.querySelectorAll('figure')[fi];
      const hint = [...f.querySelectorAll('[data-how-to-play-press-hint]')].find((x) => x.getBoundingClientRect().width > 0);
      if (!hint) return null;
      const r = hint.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, Number(fi));
    if (!q) { lines.push(`tap ${t}: no hint`); break; }
    if (dev === 'pc') await page.mouse.click(q.x, q.y); else await page.touchscreen.tap(q.x, q.y);
    const start = Date.now();
    while (Date.now() - start < 2200) {
      const info = await p.evaluate((el) => {
        const holder = el.querySelector(':scope > span.absolute');
        const shown = !holder.querySelector('span').classList.contains('invisible');
        const b = holder.querySelector('button').getBoundingClientRect();
        let worst = null;
        for (const f of el.querySelectorAll('figure')) {
          for (const e of f.querySelectorAll('svg *, svg, div, span, img')) {
            const cs = getComputedStyle(e);
            if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue;
            const r = e.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            // 盤面全体を包む箱は除く（ボタンより十分大きい箱）
            if (r.width > 200 && r.height > 120) continue;
            const ox = Math.min(r.right, b.right) - Math.max(r.left, b.left);
            const oy = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
            if (ox > 0 && oy > 0) {
              const area = ox * oy;
              if (!worst || area > worst.area) worst = { area: Math.round(area), tag: e.tagName, cls: (e.getAttribute('class') || '').slice(0, 40), r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] };
            }
          }
        }
        return { shown, btn: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], worst };
      });
      const ms = Date.now() - start;
      const f = `${prefix}-t${t}-${String(frame).padStart(3, '0')}.png`;
      if (frame % 3 === 0 || (info.worst && info.shown)) await page.screenshot({ path: f });
      lines.push(`t${t} ${ms}ms shown=${info.shown} btn=${info.btn} worst=${JSON.stringify(info.worst)}`);
      frame++;
      await page.waitForTimeout(40);
    }
  }
  fs.writeFileSync(`${prefix}-log.txt`, lines.join('\n'));
  console.log(lines.filter((l) => l.includes('shown=true') && !l.includes('worst=null')).slice(0, 20).join('\n') || 'no overlap while shown');
  await browser.close();
})();
