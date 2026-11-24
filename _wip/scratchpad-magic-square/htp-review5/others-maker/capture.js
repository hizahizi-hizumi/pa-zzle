// usage: node capture.js <version> <dev> <game>
const fs = require('fs');
const path = require('path');
const { chromium, ROOT, openHelp, waitGoalDone, scrollerHandle, shootTab } = require('./lib');

const TABS = [
  ['rules', 'ルール'],
  ['operations', '操作'],
  ['scoring', '採点'],
];

// Collected inside the page for the active tab.
function collectMetrics() {
  const r2 = (r) => ({ x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, r: Math.round(r.right * 10) / 10, b: Math.round(r.bottom * 10) / 10 });
  const panel = document.querySelector('[role=tabpanel][data-state=active]');
  const out = { headings: [], panels: [], flows: [], menus: [], scoreRows: [], overflow: [] };
  for (const h of panel.querySelectorAll('h2,h3,h4')) {
    const cs = getComputedStyle(h);
    const rr = h.getBoundingClientRect();
    if (rr.width === 0) continue;
    out.headings.push({ tag: h.tagName, text: h.textContent.slice(0, 40), fs: cs.fontSize, fw: cs.fontWeight, lh: cs.lineHeight, rect: r2(rr) });
  }
  const inkBoxes = (cap) => {
    const boxes = [];
    const tw = document.createTreeWalker(cap, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      if (!t.textContent.trim()) continue;
      const el = t.parentElement;
      // visible only
      let vis = true;
      for (let e = el; e && e !== cap.parentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') { vis = false; break; }
      }
      if (!vis) continue;
      const hr = el.getBoundingClientRect();
      if (hr.width <= 1) continue;
      range.selectNodeContents(t);
      const rr = range.getBoundingClientRect();
      if (rr.width > 1) boxes.push({ text: t.textContent.slice(0, 20), ...r2(rr) });
    }
    return boxes;
  };
  for (const p of panel.querySelectorAll('[data-reset-button-placement]')) {
    const pr = p.getBoundingClientRect();
    if (pr.width === 0) continue;
    const cs = getComputedStyle(p);
    const btnSpan = p.querySelector(':scope > span.absolute');
    const btn = btnSpan ? btnSpan.querySelector('button') : null;
    const visibleSpan = btnSpan ? btnSpan.querySelector('span') : null;
    const figs = [...p.querySelectorAll('figure')].map((f) => {
      const cap = f.querySelector(':scope > figcaption');
      return { rect: r2(f.getBoundingClientRect()), nested: f.parentElement.closest('figure') !== null && p.contains(f.parentElement.closest('figure')), caption: cap ? { rect: r2(cap.getBoundingClientRect()), ink: inkBoxes(cap) } : null, hints: [...f.querySelectorAll('[data-how-to-play-press-hint]')].map((h) => r2(h.getBoundingClientRect())) };
    });
    out.panels.push({
      placement: p.getAttribute('data-reset-button-placement'),
      rect: r2(pr),
      pt: cs.paddingTop, pb: cs.paddingBottom, bg: cs.backgroundColor,
      heading: (p.parentElement.querySelector('h3,h4') || {}).textContent?.slice(0, 40) ?? null,
      btn: btn ? { rect: r2(btn.getBoundingClientRect()), visible: visibleSpan ? !visibleSpan.classList.contains('invisible') : null, disabled: btn.disabled } : null,
      figs,
    });
  }
  // flow figure panels: in after = div.rounded-lg.border with figure; in before = bg-muted panel without data-reset in scoring tab
  for (const d of panel.querySelectorAll('div.rounded-lg')) {
    if (d.hasAttribute('data-reset-button-placement')) continue;
    if (!d.querySelector('figure')) continue;
    const cs = getComputedStyle(d);
    const dr = d.getBoundingClientRect();
    if (dr.width === 0) continue;
    // children overflow check
    let maxR = 0, minL = 1e9, maxB = 0;
    for (const e of d.querySelectorAll('*')) {
      const er = e.getBoundingClientRect();
      if (er.width === 0 && er.height === 0) continue;
      maxR = Math.max(maxR, er.right); minL = Math.min(minL, er.left); maxB = Math.max(maxB, er.bottom);
    }
    out.flows.push({ cls: d.className.slice(0, 80), rect: r2(dr), bg: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopColor, pt: cs.paddingTop, pb: cs.paddingBottom, pl: cs.paddingLeft, inert: d.closest('[inert]') !== null, childMinL: Math.round(minL), childMaxR: Math.round(maxR), childMaxB: Math.round(maxB), figures: [...d.querySelectorAll('figure')].map((f) => ({ rect: r2(f.getBoundingClientRect()), cap: (f.querySelector('figcaption') || {}).textContent?.slice(0, 40) })) });
  }
  for (const m of panel.querySelectorAll('[data-slot=dropdown-menu-static-surface]')) {
    const mr = m.getBoundingClientRect();
    if (mr.width === 0) continue;
    const li = m.closest('li');
    const lead = li ? li.querySelector(':scope > p') : null;
    out.menus.push({ rect: r2(mr), lead: lead ? lead.textContent : null, items: [...m.querySelectorAll('p')].map((p) => ({ text: p.textContent.slice(0, 30), rect: r2(p.getBoundingClientRect()), fs: getComputedStyle(p).fontSize })) });
  }
  for (const li of panel.querySelectorAll('li')) {
    const first = li.querySelector(':scope > p.font-semibold');
    if (!first) continue;
    const lr = li.getBoundingClientRect();
    if (lr.width === 0) continue;
    out.scoreRows.push({ rect: r2(lr), head: first.textContent.slice(0, 30), parts: [...li.children].map((c) => ({ tag: c.tagName, cls: c.className.slice(0, 50), fs: getComputedStyle(c).fontSize, rect: r2(c.getBoundingClientRect()), text: c.textContent.slice(0, 30) })) });
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
  // GoalFrame root: closest flex-col containing btn
  let frame = btn.closest('div.flex.flex-col');
  const boardBox = frame ? frame.firstElementChild : null;
  const tut = [...document.querySelectorAll('[role=dialog] button')].find((b) => /チュートリアル/.test(b.textContent));
  const desc = document.querySelector('[role=dialog] p.text-balance');
  // visual board: biggest descendant rect inside boardBox
  return {
    btn: r2(btn.getBoundingClientRect()),
    frame: frame ? r2(frame.getBoundingClientRect()) : null,
    frameCls: frame ? frame.className : null,
    boardBox: boardBox ? r2(boardBox.getBoundingClientRect()) : null,
    tutorial: tut ? r2(tut.getBoundingClientRect()) : null,
    desc: desc ? r2(desc.getBoundingClientRect()) : null,
  };
}

async function panelClip(page, handle, margin = 10) {
  const r = await handle.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const vp = page.viewportSize();
  const x = Math.max(0, r.x - margin);
  const y = Math.max(0, r.y - margin);
  return { x, y, width: Math.min(vp.width - x, r.w + margin * 2), height: Math.max(1, Math.min(vp.height - y, r.h + margin * 2)) };
}

async function btnState(panelHandle) {
  return panelHandle.evaluate((p) => {
    const btnSpan = p.querySelector(':scope > span.absolute');
    if (!btnSpan) return null;
    const vis = btnSpan.querySelector('span');
    const btn = btnSpan.querySelector('button');
    const b = btn.getBoundingClientRect();
    return { visible: !vis.classList.contains('invisible'), x: b.x, y: b.y, w: b.width, h: b.height, placement: p.getAttribute('data-reset-button-placement'), pt: getComputedStyle(p).paddingTop, pb: getComputedStyle(p).paddingBottom, ph: p.getBoundingClientRect().height };
  });
}

async function touchPanels(page, prefix, tabKey, log) {
  const panels = await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]');
  let pi = 0;
  const results = [];
  for (const p of panels) {
    const visibleSize = await p.evaluate((el) => el.getBoundingClientRect().width);
    if (visibleSize === 0) { pi++; continue; }
    await p.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const clip0 = await panelClip(page, p);
    const base = `${prefix}-${tabKey}-p${pi}`;
    await page.screenshot({ path: `${base}-0init.png`, clip: clip0 });
    const figCount = await p.evaluate((el) => el.querySelectorAll('figure').length);
    const res = { panel: pi, figCount, touches: [] };
    for (let fi = 0; fi < Math.min(figCount, 4); fi++) {
      // candidate points: hint centers in this figure, else buttons / labelled elements
      const cands = await p.evaluate((el, fi) => {
        const f = el.querySelectorAll('figure')[fi];
        const pts = [];
        for (const h of f.querySelectorAll('[data-how-to-play-press-hint]')) {
          const r = h.getBoundingClientRect();
          if (r.width > 0) pts.push({ kind: 'hint', x: r.x + r.width / 2, y: r.y + r.height / 2 });
        }
        const btns = [...f.querySelectorAll('button:not([disabled]), [role=button], [role=gridcell], [aria-label]')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 4 && r.height > 4; });
        for (const b of btns.slice(0, 6)) {
          const r = b.getBoundingClientRect();
          pts.push({ kind: 'btn:' + (b.getAttribute('aria-label') || b.tagName).slice(0, 20), x: r.x + r.width / 2, y: r.y + r.height / 2 });
        }
        return pts;
      }, fi);
      let touched = null;
      for (const [ci, c] of cands.slice(0, 5).entries()) {
        await page.mouse.click(c.x, c.y);
        await page.waitForTimeout(1300);
        const st = await btnState(p);
        if (st && st.visible) { touched = { how: 'click', ...c, st }; break; }
        // try drags (swipe / trace / pull)
        let ok = false;
        if (c.kind !== 'hint' && ci > 0) continue;
        for (const [dx, dy] of [[60, 0], [0, 60], [-60, 0], [0, -60]]) {
          await page.mouse.move(c.x, c.y);
          await page.mouse.down();
          for (let s = 1; s <= 8; s++) { await page.mouse.move(c.x + (dx * s) / 8, c.y + (dy * s) / 8); await page.waitForTimeout(16); }
          await page.mouse.up();
          await page.waitForTimeout(1300);
          const st2 = await btnState(p);
          if (st2 && st2.visible) { touched = { how: `drag ${dx},${dy}`, ...c, st: st2 }; ok = true; break; }
        }
        if (ok) break;
      }
      if (!touched) { res.touches.push({ fig: fi, touched: false, cands: cands.length }); continue; }
      // after touch: screenshot panel (clip recomputed, panel might grow)
      await page.waitForTimeout(400);
      const clip1 = await panelClip(page, p);
      const f = `${base}-f${fi}-touched.png`;
      await page.screenshot({ path: f, clip: clip1 });
      const geo = await p.evaluate((el, fi) => {
        const r2 = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), r: Math.round(r.right), b: Math.round(r.bottom) });
        const btn = el.querySelector(':scope > span.absolute button').getBoundingClientRect();
        const figs = [...el.querySelectorAll('figure')].map((f) => r2(f.getBoundingClientRect()));
        // overlap of button with any visible leaf element inside the figures (ink)
        const hits = [];
        for (const f of el.querySelectorAll('figure')) {
          for (const e of f.querySelectorAll('*')) {
            if (e.childElementCount > 0 && !(e instanceof SVGElement)) continue;
            const cs = getComputedStyle(e);
            if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
            const r = e.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            const ov = !(r.right <= btn.left || r.left >= btn.right || r.bottom <= btn.top || r.top >= btn.bottom);
            if (ov) hits.push({ tag: e.tagName, text: (e.textContent || '').slice(0, 12), ...r2(r) });
          }
        }
        // text nodes ink
        const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let t = tw.nextNode(); t; t = tw.nextNode()) {
          if (!t.textContent.trim()) continue;
          const pe = t.parentElement;
          if (pe.closest('span.absolute') && pe.closest('span.absolute').parentElement === el) continue;
          let vis = true;
          for (let e = pe; e && e !== el; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.opacity === '0') { vis = false; break; } }
          if (!vis) continue;
          range.selectNodeContents(t);
          for (const r of range.getClientRects()) {
            if (r.width < 2) continue;
            const ov = !(r.right <= btn.left || r.left >= btn.right || r.bottom <= btn.top || r.top >= btn.bottom);
            if (ov) hits.push({ tag: '#text', text: t.textContent.slice(0, 12), ...r2(r) });
          }
        }
        const dist = (fr) => { const cx = (btn.left + btn.right) / 2, cy = (btn.top + btn.bottom) / 2; const dx = Math.max(fr.x - cx, 0, cx - fr.r); const dy = Math.max(fr.y - cy, 0, cy - fr.b); return Math.round(Math.hypot(dx, dy)); };
        const pr = el.getBoundingClientRect();
        return { btn: r2(btn), panel: r2(pr), figs, hits, dists: figs.map(dist), btnInPanel: btn.left >= pr.left && btn.right <= pr.right && btn.top >= pr.top && btn.bottom <= pr.bottom };
      }, fi);
      const touch = { fig: fi, touched: true, how: touched.how, kind: touched.kind, state: touched.st, geo, shot: f };
      // reset
      const rb = await p.$(':scope > span.absolute button');
      await rb.click();
      await page.waitForTimeout(900);
      const after = await btnState(p);
      touch.afterReset = after;
      await page.screenshot({ path: `${base}-f${fi}-reset.png`, clip: await panelClip(page, p) });
      res.touches.push(touch);
    }
    results.push(res);
    log(`${tabKey} panel ${pi}: figs=${figCount} touches=${res.touches.map((t) => (t.touched ? `f${t.fig}:${t.how}` : `f${t.fig}:none`)).join(',')}`);
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
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${prefix}-00-open.png` });
    const waited = await waitGoalDone(page);
    log(`goal done after ${waited}ms`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${prefix}-01-goal-done.png` });
    result.goal = await page.evaluate(collectGoal);
    // replay mid-way
    const replay = page.locator('[role=dialog] button[aria-label="始まりの盤面から見せ直す"]');
    if (await replay.count()) {
      await replay.click();
      await page.waitForTimeout(700);
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
      await shootTab(page, `${prefix}-tab-${key}`);
      // metrics need everything laid out; rects are viewport-relative but relative comparisons are fine
      result.tabs[key] = { metrics: await page.evaluate(collectMetrics) };
      if (key !== 'scoring') {
        result.tabs[key].touches = await touchPanels(page, prefix, key, log);
      }
      // flow figure clips
      const flows = await page.$$('[role=tabpanel][data-state=active] div.rounded-lg:not([data-reset-button-placement])');
      let fi = 0;
      for (const fl of flows) {
        const has = await fl.evaluate((el) => el.querySelector('figure') !== null && el.getBoundingClientRect().width > 0);
        if (!has) continue;
        await fl.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${prefix}-${key}-flow${fi}.png`, clip: await panelClip(page, fl, 24) });
        fi++;
      }
      // menu clip
      const menus = await page.$$('[role=tabpanel][data-state=active] [data-slot=dropdown-menu-static-surface]');
      let mi = 0;
      for (const m of menus) {
        const li = await m.evaluateHandle((el) => el.closest('li') || el);
        const w = await li.evaluate((el) => el.getBoundingClientRect().width);
        if (w === 0) continue;
        await li.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${prefix}-${key}-menu${mi}.png`, clip: await panelClip(page, li, 12) });
        mi++;
      }
      await h.evaluate((el) => { el.scrollTop = 0; });
    }
    result.errors = errors;
    await ctx.close();
  } catch (e) {
    result.fatal = String(e && e.stack || e);
    log('FATAL ' + result.fatal);
  }
  fs.writeFileSync(`${prefix}-result.json`, JSON.stringify(result, null, 1));
  fs.writeFileSync(`${prefix}-log.txt`, lines.join('\n'));
  await browser.close();
})();
