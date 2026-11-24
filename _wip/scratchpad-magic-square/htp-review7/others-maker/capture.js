// 1つのゲーム・版・端末で、遊び方をゲームのホームから開き、ゴール・3つのタブ・例ごとの元に戻すボタンを撮って測る。
// usage: node capture.js <before|after> <phone|w320|pc> <game>
const fs = require('fs');
const path = require('path');
const { chromium, ROOT, openHelp, waitGoalDone, scrollerHandle, stickyBottom, shootTab } = require('./lib');

const TABS = [
  ['rules', 'ルール'],
  ['operations', '操作'],
  ['scoring', '採点'],
];

// ---- ページの中で測る関数 ----

function collectMetrics() {
  const r2 = (r) => ({ x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, r: Math.round(r.right * 10) / 10, b: Math.round(r.bottom * 10) / 10 });
  const panel = document.querySelector('[role=tabpanel][data-state=active]');
  const out = { headings: [], panels: [], flows: [], textBlocks: [], overflow: [] };
  for (const h of panel.querySelectorAll('h2,h3,h4')) {
    const cs = getComputedStyle(h);
    const rr = h.getBoundingClientRect();
    if (rr.width === 0) continue;
    out.headings.push({ tag: h.tagName, cls: h.className.slice(0, 60), text: h.textContent.slice(0, 40), fs: cs.fontSize, fw: cs.fontWeight, rect: r2(rr) });
  }
  for (const p of panel.querySelectorAll('[data-reset-button-placement]')) {
    const pr = p.getBoundingClientRect();
    if (pr.width === 0) continue;
    const cs = getComputedStyle(p);
    out.panels.push({
      placement: p.getAttribute('data-reset-button-placement'),
      rect: r2(pr), pt: cs.paddingTop, pb: cs.paddingBottom,
      heading: (p.parentElement.querySelector('h3,h4') || {}).textContent?.slice(0, 40) ?? null,
      figs: [...p.querySelectorAll('figure')].map((f) => ({ rect: r2(f.getBoundingClientRect()), board: r2(f.firstElementChild.getBoundingClientRect()), nested: !!f.parentElement.closest('figure') })),
    });
  }
  // 押せない流れの図の面（変更後は縁の線の面、変更前は地の面）。
  for (const d of panel.querySelectorAll('div.rounded-lg')) {
    if (d.hasAttribute('data-reset-button-placement')) continue;
    if (!d.querySelector('figure')) continue;
    if (d.parentElement.closest('div.rounded-lg') && d.parentElement.closest('div.rounded-lg').querySelector('figure')) continue;
    const cs = getComputedStyle(d);
    const dr = d.getBoundingClientRect();
    if (dr.width === 0) continue;
    let maxR = -1e9, minL = 1e9;
    for (const e of d.querySelectorAll('*')) {
      const er = e.getBoundingClientRect();
      if (er.width === 0 && er.height === 0) continue;
      maxR = Math.max(maxR, er.right); minL = Math.min(minL, er.left);
    }
    const caps = [...d.querySelectorAll('figcaption')].map((c) => {
      const spans = [...c.querySelectorAll('span.inline-block')];
      const tops = [...new Set(spans.map((s) => Math.round(s.getBoundingClientRect().top)))];
      return { text: c.textContent.slice(0, 50), lines: tops.length };
    });
    out.flows.push({ rect: r2(dr), bg: cs.backgroundColor, border: cs.borderTopWidth, pt: cs.paddingTop, pb: cs.paddingBottom, inert: d.closest('[inert]') !== null, childMinL: Math.round(minL), childMaxR: Math.round(maxR), caps });
  }
  // 文節で折り返す文（採点の行・メニューの図・まとまりの一文など）の行数と最後の行。
  const blocks = new Set();
  for (const s of panel.querySelectorAll('span.inline-block')) {
    const b = s.parentElement;
    if (b) blocks.add(b);
  }
  for (const b of blocks) {
    const br = b.getBoundingClientRect();
    if (br.width === 0) continue;
    const spans = [...b.children].filter((c) => c.matches('span.inline-block'));
    if (spans.length === 0) continue;
    const lines = new Map();
    let over = 0;
    // 行の幅の基準は文の箱（ブロックなら自身、インラインなら最も近いブロックの親）。
    let box = b;
    while (box && getComputedStyle(box).display.startsWith('inline')) box = box.parentElement;
    const limit = box.getBoundingClientRect();
    for (const s of spans) {
      const sr = s.getBoundingClientRect();
      const key = Math.round(sr.top);
      lines.set(key, (lines.get(key) || '') + s.textContent);
      over = Math.max(over, sr.right - limit.right, limit.left - sr.left);
    }
    const ls = [...lines.values()];
    const where = b.closest('[data-slot=dropdown-menu-static-surface]') ? 'menu' : b.closest('li') ? 'li' : b.closest('figcaption') ? 'figcaption' : b.closest('h3,h4') ? 'heading' : 'p';
    out.textBlocks.push({ where, tag: b.tagName, cls: (b.getAttribute('class') || '').slice(0, 40), fs: getComputedStyle(b).fontSize, text: b.textContent.slice(0, 60), lines: ls.length, last: ls[ls.length - 1], overflowPx: Math.round(over), rect: r2(br) });
  }
  const vw = window.innerWidth;
  const pr = panel.getBoundingClientRect();
  for (const e of panel.querySelectorAll('*')) {
    const er = e.getBoundingClientRect();
    if (er.width === 0 || er.height === 0) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden') continue;
    if (er.right > Math.min(vw, pr.right) + 1 || er.left < Math.max(0, pr.left) - 1) {
      out.overflow.push({ tag: e.tagName, cls: (e.getAttribute('class') || '').slice(0, 60), rect: r2(er) });
    }
  }
  out.overflow = out.overflow.slice(0, 30);
  return out;
}

function collectGoal() {
  const r2 = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) });
  const btn = document.querySelector('[role=dialog] button[aria-label="始まりの盤面から見せ直す"]');
  if (!btn) return null;
  const frame = btn.closest('div.flex.flex-col');
  const boardBox = frame ? frame.firstElementChild : null;
  const tut = [...document.querySelectorAll('[role=dialog] button')].find((b) => /チュートリアル/.test(b.textContent));
  return { btn: r2(btn.getBoundingClientRect()), frame: frame ? r2(frame.getBoundingClientRect()) : null, boardBox: boardBox ? r2(boardBox.getBoundingClientRect()) : null, tutorial: tut ? r2(tut.getBoundingClientRect()) : null };
}

/** 面の元に戻すボタンの姿と、触った例との関係。 */
function probeButton(el, [fi, sticky]) {
  const r2 = (r) => ({ x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
  const holder = el.querySelector(':scope > span.absolute');
  const button = holder.querySelector('button');
  const shown = !holder.querySelector('span').classList.contains('invisible');
  const b = button.getBoundingClientRect();
  const figs = [...el.querySelectorAll('figure')];
  const figRects = figs.map((f) => r2(f.getBoundingClientRect()));
  const boards = figs.map((f) => r2(f.firstElementChild.getBoundingClientRect()));
  const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
  const dist = (fr) => Math.round(Math.hypot(Math.max(fr.x - cx, 0, cx - fr.r), Math.max(fr.y - cy, 0, cy - fr.b)));
  const dists = figRects.map(dist);
  const nearest = dists.indexOf(Math.min(...dists));
  // 字の矩形と盤面の葉の要素のうち、ボタンに重なるもの。
  const hits = [];
  const ov = (r) => !(r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    if (!t.textContent.trim()) continue;
    const pe = t.parentElement;
    if (holder.contains(pe)) continue;
    let vis = true;
    for (let e = pe; e && e !== el; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.opacity === '0') { vis = false; break; } }
    if (!vis) continue;
    const hb = pe.getBoundingClientRect();
    if (hb.width <= 1) continue;
    range.selectNodeContents(t);
    for (const r of range.getClientRects()) if (r.width >= 2 && ov(r)) hits.push({ kind: 'text', text: t.textContent.slice(0, 12) });
  }
  for (const f of figs) {
    for (const e of f.querySelectorAll('*')) {
      if (e.childElementCount > 0) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue;
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (ov(r)) hits.push({ kind: 'leaf', tag: e.tagName, label: (e.getAttribute('aria-label') || e.getAttribute('class') || '').slice(0, 30), rect: r2(r) });
    }
  }
  const boardHits = boards.map((bd, i) => (ov({ left: bd.x, right: bd.r, top: bd.y, bottom: bd.b }) ? i : -1)).filter((i) => i >= 0);
  const pr = el.getBoundingClientRect();
  const vh = window.innerHeight;
  return {
    placement: el.getAttribute('data-reset-button-placement'),
    side: holder.getAttribute('data-reset-button-side'),
    shown, disabled: button.disabled,
    btn: r2(b), panel: r2(pr), figs: figRects, boards, dists, nearest, touched: fi,
    nearTouched: nearest === fi,
    // 触った例の縦の範囲とボタンの縦の範囲が重なるか（横に並ぶか）
    besideTouchedRow: fi >= 0 ? b.bottom > figRects[fi].y - 4 && b.top < figRects[fi].b + 4 : null,
    inViewport: b.top >= sticky && b.bottom <= vh && b.left >= 0 && b.right <= window.innerWidth,
    underSticky: b.top < sticky,
    inPanel: b.left >= pr.left - 0.5 && b.right <= pr.right + 0.5 && b.top >= pr.top - 0.5 && b.bottom <= pr.bottom + 0.5,
    hits, boardHits,
  };
}

// ---- 操作 ----

async function panelClip(page, handle, margin = 10) {
  const r = await handle.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const vp = page.viewportSize();
  const x = Math.max(0, r.x - margin);
  const y = Math.max(0, r.y - margin);
  const bottom = Math.min(vp.height, r.y + r.h + margin);
  return { x, y, width: Math.min(vp.width - x, r.w + margin * 2), height: Math.max(1, bottom - y) };
}

async function isChanged(p) {
  return p.evaluate((el) => {
    const s = el.querySelector(':scope > span.absolute');
    return s ? !s.querySelector('span').classList.contains('invisible') : false;
  });
}

async function scrollFigureIntoView(page, p, fi, sticky) {
  await p.evaluate((el, args) => {
    const [fi, sticky] = args;
    const f = el.querySelectorAll('figure')[fi];
    const r = f.getBoundingClientRect();
    const vh = window.innerHeight;
    let sc = f.parentElement;
    while (sc && sc !== document.body) {
      const cs = getComputedStyle(sc);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 2) break;
      sc = sc.parentElement;
    }
    if (!sc || sc === document.body) sc = document.scrollingElement;
    const avail = vh - sticky;
    // 例が見える所に収まれば、例を見える所の中央に。収まらなければ例の上端を帯の下 12px に。
    const target = r.height + 24 <= avail ? sticky + (avail - r.height) / 2 : sticky + 12;
    sc.scrollTop += r.top - target;
  }, [fi, sticky]);
  await page.waitForTimeout(350);
}

async function tapAt(page, dev, x, y) {
  if (dev === 'pc') await page.mouse.click(x, y);
  else await page.touchscreen.tap(x, y);
}

async function dragFrom(page, x, y, dx, dy) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let s = 1; s <= 10; s++) { await page.mouse.move(x + (dx * s) / 10, y + (dy * s) / 10); await page.waitForTimeout(16); }
  await page.mouse.up();
}

/** 例を1つ変える。手がかりを押す→手がかりから引く→押せる物を押す、の順に試す。 */
async function changeFigure(page, dev, p, fi) {
  const cands = await p.evaluate((el, fi) => {
    const f = el.querySelectorAll('figure')[fi];
    const pts = [];
    for (const h of f.querySelectorAll('[data-how-to-play-press-hint]')) {
      const r = h.getBoundingClientRect();
      if (r.width > 0) pts.push({ kind: 'hint', x: r.x + r.width / 2, y: r.y + r.height / 2 });
    }
    const btns = [...f.querySelectorAll('button:not([disabled]), [role=button], [role=gridcell], [aria-label]')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 4 && r.height > 4; });
    for (const b of btns.slice(0, 8)) {
      const r = b.getBoundingClientRect();
      pts.push({ kind: 'el:' + (b.getAttribute('aria-label') || b.tagName).slice(0, 24), x: r.x + r.width / 2, y: r.y + r.height / 2 });
    }
    const br = f.firstElementChild.getBoundingClientRect();
    pts.push({ kind: 'center', x: br.x + br.width / 2, y: br.y + br.height / 2 });
    return pts;
  }, fi);
  const dirs = [[70, 0], [-70, 0], [0, 70], [0, -70]];
  for (const c of cands.filter((c) => c.kind === 'hint')) {
    await tapAt(page, dev, c.x, c.y);
    await page.waitForTimeout(900);
    if (await isChanged(p)) return { how: 'tap-hint', ...c };
    for (const [dx, dy] of dirs) {
      await dragFrom(page, c.x, c.y, dx, dy);
      await page.waitForTimeout(1000);
      if (await isChanged(p)) return { how: `drag ${dx},${dy}`, ...c };
    }
  }
  for (const c of cands.filter((c) => c.kind.startsWith('el:')).slice(0, 8)) {
    await tapAt(page, dev, c.x, c.y);
    await page.waitForTimeout(900);
    if (await isChanged(p)) return { how: 'tap-el', ...c };
  }
  for (const c of cands.filter((c) => c.kind === 'center')) {
    for (const [dx, dy] of dirs) {
      await dragFrom(page, c.x, c.y, dx, dy);
      await page.waitForTimeout(1000);
      if (await isChanged(p)) return { how: `drag ${dx},${dy}`, ...c };
    }
  }
  return null;
}

async function pressReset(page, p) {
  const ok = await p.evaluate((el) => {
    const b = el.querySelector(':scope > span.absolute button');
    if (!b || b.disabled) return false;
    b.click();
    return true;
  });
  await page.waitForTimeout(900);
  return ok;
}

/** スマートフォンで、指で送る手（触れて上へ動かして離す）を、点 (x,y) から始める。 */
async function touchScroll(page, x, y, dy) {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  const steps = 12;
  for (let s = 1; s <= steps; s++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * s) / steps }] });
    await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
  await page.waitForTimeout(700);
}

async function touchPanels(page, dev, prefix, tabKey, log, version) {
  const sticky = dev === 'pc' ? 0 : await stickyBottom(page);
  const all = await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]');
  const results = [];
  let pi = 0;
  for (const p of all) {
    const w = await p.evaluate((el) => el.getBoundingClientRect().width);
    if (w === 0) continue;
    const figCount = await p.evaluate((el) => el.querySelectorAll('figure').length);
    const heading = await p.evaluate((el) => (el.parentElement.querySelector('h3,h4') || {}).textContent?.slice(0, 40) ?? null);
    const base = `${prefix}-${tabKey}-p${pi}`;
    await p.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${base}-0init.png`, clip: await panelClip(page, p) });
    const res = { panel: pi, heading, figCount, panelHeight: await p.evaluate((el) => Math.round(el.getBoundingClientRect().height)), touches: [], seq: null, scroll: null };
    for (let fi = 0; fi < Math.min(figCount, 4); fi++) {
      await scrollFigureIntoView(page, p, fi, sticky);
      const how = await changeFigure(page, dev, p, fi);
      if (!how) { res.touches.push({ fig: fi, touched: false }); continue; }
      await page.waitForTimeout(500);
      const geo = await p.evaluate(probeButton, [fi, sticky]);
      const shotView = `${base}-f${fi}-touched-view.png`;
      await page.screenshot({ path: shotView });
      const shotPanel = `${base}-f${fi}-touched.png`;
      await page.screenshot({ path: shotPanel, clip: await panelClip(page, p) });
      await pressReset(page, p);
      const after = await p.evaluate(probeButton, [-1, sticky]);
      res.touches.push({ fig: fi, touched: true, how: how.how, kind: how.kind, geo, afterResetShown: after.shown, shotView, shotPanel });
    }
    // 2つの例を続けて触る: 1つ目を変えた後で2つ目を変える（ボタンが2つ目の横へ移るか）
    if (figCount >= 2 && version === "after") {
      await scrollFigureIntoView(page, p, 0, sticky);
      const a = await changeFigure(page, dev, p, 0);
      if (a) {
        await scrollFigureIntoView(page, p, 1, sticky);
        const b = await changeFigure(page, dev, p, 1);
        const geo = await p.evaluate(probeButton, [1, sticky]);
        const shot = `${base}-seq01-view.png`;
        await page.screenshot({ path: shot });
        res.seq = { a: !!a, b: b ? b.how : null, geo, shot };
        await pressReset(page, p);
      }
      // 指で送る手: 1つ目を変えた後、2つ目の例の上から指で送る（スマートフォンだけ）
      if (dev !== 'pc') {
        await scrollFigureIntoView(page, p, 0, sticky);
        const a2 = await changeFigure(page, dev, p, 0);
        if (a2) {
          await scrollFigureIntoView(page, p, 1, sticky);
          const before = await p.evaluate(probeButton, [0, sticky]);
          const shot0 = `${base}-scroll-on-f1-0before-view.png`;
          await page.screenshot({ path: shot0 });
          const pt = await p.evaluate((el) => {
            const f = el.querySelectorAll('figure')[1];
            const cap = f.querySelector('figcaption');
            const board = f.firstElementChild.getBoundingClientRect();
            // 盤面の上で、触ると操作になる物（touch-action: none）が無い所を選ぶ
            const pts = [[board.x + board.width / 2, board.y + board.height / 2], [board.x + 6, board.y + 6], [board.right - 6, board.bottom - 6]];
            if (cap) { const c = cap.getBoundingClientRect(); pts.push([c.x + c.width / 2, c.y + c.height / 2]); }
            for (const [x, y] of pts) {
              const hit = document.elementFromPoint(x, y);
              let blocked = false;
              for (let e = hit; e && e !== el; e = e.parentElement) if (getComputedStyle(e).touchAction === 'none') { blocked = true; break; }
              if (!blocked) return { x, y, on: hit ? hit.tagName + '.' + (hit.getAttribute('class') || '').slice(0, 30) : null };
            }
            return null;
          });
          if (pt) {
            const h = await scrollerHandle(page);
            const st0 = await h.evaluate((el) => el.scrollTop);
            await touchScroll(page, pt.x, pt.y, -120);
            const st1 = await h.evaluate((el) => el.scrollTop);
            const geo = await p.evaluate(probeButton, [0, sticky]);
            const shot = `${base}-scroll-on-f1-view.png`;
            await page.screenshot({ path: shot });
            const relBefore = before.btn.y - before.panel.y;
            const relAfter = geo.btn.y - geo.panel.y;
            res.scroll = { start: pt, scrolled: st1 - st0, before: { side: before.side, rel: relBefore, nearest: before.nearest }, after: { side: geo.side, rel: relAfter, nearest: geo.nearest, shown: geo.shown }, moved: before.side !== geo.side || Math.abs(relBefore - relAfter) > 1 || before.btn.x !== geo.btn.x, shot0, shot };
          }
          await pressReset(page, p);
        }
      }
    }
    results.push(res);
    log(`${tabKey} p${pi} "${heading}": figs=${figCount} ` + res.touches.map((t) => (t.touched ? `f${t.fig}:${t.how}:${t.geo.placement}/${t.geo.side}:near=${t.geo.nearTouched}:view=${t.geo.inViewport}:hits=${t.geo.hits.length}` : `f${t.fig}:none`)).join(' ') + (res.scroll ? ` scroll:${res.scroll.scrolled}px moved=${res.scroll.moved}` : ''));
    pi++;
  }
  return results;
}

(async () => {
  const [version, dev, game] = process.argv.slice(2);
  const dir = path.join(ROOT, 'shots', game);
  fs.mkdirSync(dir, { recursive: true });
  const prefix = path.join(dir, `${version}-${dev}`);
  const lines = [];
  const log = (s) => { lines.push(s); console.log(`[${game} ${version} ${dev}] ${s}`); };
  const browser = await chromium.launch();
  const result = { game, version, dev, tabs: {} };
  try {
    const { ctx, page, errors } = await openHelp(browser, version, dev, game);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${prefix}-00-open.png` });
    const waited = await waitGoalDone(page);
    log(`goal done after ${waited}ms`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${prefix}-01-goal-done.png` });
    result.goal = await page.evaluate(collectGoal);
    const replay = page.locator('[role=dialog] button[aria-label="始まりの盤面から見せ直す"]');
    if (await replay.count()) {
      await replay.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${prefix}-02-goal-replaying.png` });
      result.goalReplaying = await page.evaluate(collectGoal);
      await waitGoalDone(page);
      await page.waitForTimeout(500);
    }
    for (const [key, label] of TABS) {
      await page.getByRole('tab', { name: label }).click();
      await page.waitForTimeout(600);
      const h = await scrollerHandle(page);
      await h.evaluate((el) => { el.scrollTop = 0; });
      await page.waitForTimeout(200);
      result.tabs[key] = { metrics: await page.evaluate(collectMetrics) };
      await shootTab(page, `${prefix}-tab-${key}`);
      if (key !== 'scoring') {
        result.tabs[key].touches = await touchPanels(page, dev, prefix, key, log, version);
      }
      await h.evaluate((el) => { el.scrollTop = 0; });
    }
    result.errors = errors;
    await ctx.close();
  } catch (e) {
    result.fatal = String((e && e.stack) || e);
    log('FATAL ' + result.fatal);
  }
  fs.writeFileSync(`${prefix}-result.json`, JSON.stringify(result, null, 1));
  fs.writeFileSync(`${prefix}-log.txt`, lines.join('\n'));
  await browser.close();
})();
