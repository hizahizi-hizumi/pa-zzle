// 自動の手順で変えられなかった例を、例の中の押せる物を順に押して変え、元に戻すボタンの所を測って撮る。
// usage: node touch-each.js <before|after> <phone|w320|pc> <game> <rules|operations> <panel> <figure>[,<figure>...]
const fs = require('fs');
const path = require('path');
const { chromium, ROOT, openHelp, waitGoalDone, stickyBottom } = require('./lib');
const TABS = { rules: 'ルール', operations: '操作' };

(async () => {
  const [version, dev, game, tab, pi, figs] = process.argv.slice(2);
  const dir = path.join(ROOT, 'shots', game, 'each');
  fs.mkdirSync(dir, { recursive: true });
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
  const out = [];
  for (const fi of figs.split(',').map(Number)) {
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
      const r = f.getBoundingClientRect();
      const avail = window.innerHeight - sticky;
      sc.scrollTop += r.top - (sticky + Math.max(12, (avail - r.height) / 2));
    }, [fi, sticky]);
    await page.waitForTimeout(400);
    const cands = await p.evaluate((el, fi) => {
      const f = el.querySelectorAll('figure')[fi];
      return [...f.querySelectorAll('button:not([disabled]), [role=button], [role=gridcell]')]
        .map((b) => { const r = b.getBoundingClientRect(); return { label: (b.getAttribute('aria-label') || b.textContent || b.tagName).slice(0, 30), x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })
        .filter((c) => c.w > 4 && c.h > 4);
    }, fi);
    let done = null;
    for (const c of cands) {
      if (dev === 'pc') await page.mouse.click(c.x, c.y); else await page.touchscreen.tap(c.x, c.y);
      await page.waitForTimeout(700);
      const changed = await p.evaluate((el) => !el.querySelector(':scope > span.absolute span').classList.contains('invisible'));
      if (changed) { done = c; break; }
    }
    if (!done) {
      // 押すだけで変わらなければ、押せる物から隣へなぞる
      for (const c of cands) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const step = Math.max(c.w, c.h);
          await page.mouse.move(c.x, c.y);
          await page.mouse.down();
          for (let s = 1; s <= 8; s++) { await page.mouse.move(c.x + (dx * step * s) / 8, c.y + (dy * step * s) / 8); await page.waitForTimeout(16); }
          await page.mouse.up();
          await page.waitForTimeout(600);
          const changed = await p.evaluate((el) => !el.querySelector(':scope > span.absolute span').classList.contains('invisible'));
          if (changed) { done = { ...c, label: `drag ${dx},${dy} from ${c.label}` }; break; }
        }
        if (done) break;
      }
    }
    await page.waitForTimeout(600);
    const geo = await p.evaluate((el, args) => {
      const [fi, sticky] = args;
      const r2 = (r) => ({ x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
      const holder = el.querySelector(':scope > span.absolute');
      const b = holder.querySelector('button').getBoundingClientRect();
      const figRects = [...el.querySelectorAll('figure')].map((f) => r2(f.getBoundingClientRect()));
      const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
      const dists = figRects.map((fr) => Math.round(Math.hypot(Math.max(fr.x - cx, 0, cx - fr.r), Math.max(fr.y - cy, 0, cy - fr.b))));
      return { placement: el.getAttribute('data-reset-button-placement'), side: holder.getAttribute('data-reset-button-side'), shown: !holder.querySelector('span').classList.contains('invisible'), btn: r2(b), figs: figRects, nearest: dists.indexOf(Math.min(...dists)), inViewport: b.top >= sticky && b.bottom <= window.innerHeight };
    }, [fi, sticky]);
    const shot = path.join(dir, `${version}-${dev}-${tab}-p${pi}-f${fi}.png`);
    await page.screenshot({ path: shot });
    out.push({ fi, touched: done && done.label, cands: cands.length, ...geo, shot });
    await p.evaluate((el) => { const b = el.querySelector(':scope > span.absolute button'); if (!b.disabled) b.click(); });
    await page.waitForTimeout(800);
  }
  const line = out.map((o) => `${game} ${version} ${dev} ${tab} p${pi} f${o.fi}: touched=${o.touched} (cands ${o.cands}) ${o.placement}/${o.side} btn=${o.btn.x},${o.btn.y} nearest=f${o.nearest} view=${o.inViewport} shown=${o.shown}`).join('\n');
  fs.appendFileSync(path.join(ROOT, 'touch-each.log'), line + '\n');
  console.log(line);
  await browser.close();
})();
