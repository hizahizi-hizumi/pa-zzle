// usage: node capture.js <ver: before|after> <game> <device: sp|pc>
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [ver, game, dev] = process.argv.slice(2);
const port = ver === 'after' ? 5342 : 5343;
const OUT = path.join(__dirname, 'shots', game, dev, ver);
fs.mkdirSync(OUT, { recursive: true });
const shot = (n) => path.join(OUT, n + '.png');
const TALL = 7000;

(async () => {
  const browser = await chromium.launch();
  const ctxOpts = dev === 'sp' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  const baseVp = ctxOpts.viewport;
  await page.goto(`http://localhost:${port}/puzzles/${game}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: shot('00-open-mid'), scale: 'css' });
  const replay = page.locator('button[aria-label="始まりの盤面から見せ直す"]');
  try { await page.waitForFunction(() => { const b = document.querySelector('button[aria-label="始まりの盤面から見せ直す"]'); return b && !b.disabled; }, null, { timeout: 30000 }); } catch (e) { errors.push('replay not enabled in 30s'); }
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('01-open-done'), scale: 'css' });
  // goal crop: the element containing the replay button (goal frame)
  const goalInfo = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="始まりの盤面から見せ直す"]');
    if (!b) return null;
    const frame = b.closest('div.flex.w-fit') || b.parentElement.parentElement.parentElement;
    const board = frame.firstElementChild;
    const r = frame.getBoundingClientRect(), br = b.getBoundingClientRect(), bd = board.getBoundingClientRect();
    return { frame: [r.x, r.y, r.width, r.height], button: [br.x, br.y, br.width, br.height], board: [bd.x, bd.y, bd.width, bd.height] };
  });
  // replay mid
  if (await replay.isEnabled().catch(() => false)) {
    await replay.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: shot('02-replay-mid'), scale: 'css' });
    try { await page.waitForFunction(() => { const b = document.querySelector('button[aria-label="始まりの盤面から見せ直す"]'); return b && !b.disabled; }, null, { timeout: 30000 }); } catch (e) {}
    await page.waitForTimeout(500);
  }
  const metrics = { goalInfo, tabs: {} };
  // go tall
  await page.setViewportSize({ width: baseVp.width, height: TALL });
  await page.waitForTimeout(700);
  const tabs = ['ルール', '操作', '採点'];
  for (let ti = 0; ti < tabs.length; ti++) {
    const tname = tabs[ti];
    await page.getByRole('tab', { name: tname }).click();
    await page.waitForTimeout(800);
    // measure content height to crop
    const dims = await page.evaluate(() => {
      const panel = document.querySelector('[role=tabpanel][data-state=active]');
      const r = panel.getBoundingClientRect();
      return { bottom: r.bottom, top: r.top };
    });
    const clipH = Math.min(TALL, Math.ceil(dims.bottom) + 10);
    await page.screenshot({ path: shot(`t${ti}-full-before-touch`), clip: { x: 0, y: 0, width: baseVp.width, height: clipH }, scale: 'css' });
    // collect sections (children of the space-y div)
    const sectionCount = await page.evaluate(() => {
      const panel = document.querySelector('[role=tabpanel][data-state=active]');
      const wrap = panel.querySelector(':scope > div');
      const kids = [...wrap.children].filter(k => k.getBoundingClientRect().height > 0);
      kids.forEach((k, i) => k.setAttribute('data-grader-sec', String(i)));
      return kids.length;
    });
    for (let si = 0; si < sectionCount; si++) {
      const el = page.locator(`[role=tabpanel][data-state=active] [data-grader-sec="${si}"]`);
      await el.screenshot({ path: shot(`t${ti}-s${String(si).padStart(2,'0')}-a-initial`), scale: 'css' }).catch(e => errors.push('sec shot ' + e.message.slice(0, 100)));
    }
    // text metrics
    const tm = await page.evaluate(() => {
      const panel = document.querySelector('[role=tabpanel][data-state=active]');
      const out = [];
      panel.querySelectorAll('h3,h4,p,figcaption,li,dt,dd,th,td').forEach(e => {
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
        if (r.height === 0) return;
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
        out.push({ tag: e.tagName, text: e.innerText.replace(/\s+/g, ' ').slice(0, 60), fs: cs.fontSize, fw: cs.fontWeight, lh: cs.lineHeight, lines: Math.round(r.height / lh), w: Math.round(r.width), x: Math.round(r.x) });
      });
      const panels = [...panel.querySelectorAll('[data-reset-button-placement], .rounded-lg.bg-muted, .rounded-lg.border')].map(p => { const cs = getComputedStyle(p); const r = p.getBoundingClientRect(); return { place: p.dataset.resetButtonPlacement || null, cls: p.className.slice(0, 80), pt: cs.paddingTop, pb: cs.paddingBottom, pl: cs.paddingLeft, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; });
      return { text: out, panels };
    });
    metrics.tabs[tname] = { initial: tm, touches: [] };
    // touch examples in resettable panels
    const panelCount = await page.evaluate(() => document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]').length);
    for (let pi = 0; pi < panelCount; pi++) {
      const visible = await page.evaluate((pi) => document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')[pi].getBoundingClientRect().width > 0, pi);
      if (!visible) { metrics.tabs[tname].touches.push({ pi, hidden: true }); continue; }
      const figCount = await page.evaluate((pi) => document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')[pi].querySelectorAll('figure').length, pi);
      for (let fi = 0; fi < Math.max(1, figCount); fi++) {
        let target = null; let taps = 0;
        for (let k = 0; k < 3; k++) {
          const t = await page.evaluate(([pi, fi, k]) => {
            const p = document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')[pi];
            const fig = p.querySelectorAll('figure')[fi] || p;
            const hint = fig.querySelector('[data-how-to-play-press-hint]');
            let r; let how = 'hint';
            if (hint) r = hint.getBoundingClientRect();
            else {
              if (k > 0) return null;
              const b = [...fig.querySelectorAll('button:not([disabled]),[role=button]')].find(b => !/元に戻す|見せ直す/.test(b.getAttribute('aria-label') || '') && b.getBoundingClientRect().width > 0);
              if (!b) return null;
              how = 'button'; r = b.getBoundingClientRect();
            }
            if (r.width === 0) return null;
            return { x: r.x + r.width / 2, y: r.y + r.height / 2, how };
          }, [pi, fi, k]);
          if (!t) break;
          target = t; taps++;
          if (dev === 'sp') await page.touchscreen.tap(t.x, t.y); else await page.mouse.click(t.x, t.y);
          await page.waitForTimeout(900);
          if (t.how === 'button') break;
        }
        if (!target) { metrics.tabs[tname].touches.push({ pi, fi, none: true }); continue; }
        target.taps = taps;
        const after = await page.evaluate(([pi]) => {
          const p = document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')[pi];
          const pr = p.getBoundingClientRect();
          const rb = p.querySelector('button[aria-label]:not([disabled])');
          const btns = [...p.querySelectorAll('button')].filter(b => /元に戻す/.test(b.getAttribute('aria-label') || ''));
          const b = btns[0];
          const br = b ? b.getBoundingClientRect() : null;
          const vis = b ? getComputedStyle(b.parentElement).visibility : null;
          return { place: p.dataset.resetButtonPlacement, panel: [Math.round(pr.x), Math.round(pr.y), Math.round(pr.width), Math.round(pr.height)], btn: br ? [Math.round(br.x - pr.x), Math.round(br.y - pr.y), Math.round(br.width)] : null, btnVisible: vis, disabled: b ? b.disabled : null, side: b ? (b.closest('[data-reset-button-side]')||{}).dataset?.resetButtonSide : null };
        }, [pi]);
        metrics.tabs[tname].touches.push({ pi, fi, how: target.how, taps: target.taps, ...after });
        // crop the panel's parent section
        const handle = await page.evaluateHandle((pi) => { const p = document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')[pi]; return p.closest('section') || p.parentElement; }, pi);
        await handle.asElement().screenshot({ path: shot(`t${ti}-p${String(pi).padStart(2,'0')}-f${fi}-touched`), scale: 'css' }).catch(e => errors.push('panel shot ' + e.message.slice(0, 100)));
      }
    }
    await page.screenshot({ path: shot(`t${ti}-full-after-touch`), clip: { x: 0, y: 0, width: baseVp.width, height: clipH }, scale: 'css' });
  }
  // back to normal viewport; capture scrolled views of each tab for real look
  await page.setViewportSize(baseVp);
  await page.waitForTimeout(500);
  for (let ti = 0; ti < tabs.length; ti++) {
    await page.getByRole('tab', { name: tabs[ti] }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot(`9${ti}-normal-top`), scale: 'css' });
  }
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify({ metrics, errors }, null, 1));
  await browser.close();
  console.log('done', ver, game, dev, 'errors:', errors.length);
})().catch(e => { console.error('FAIL', ver, game, dev, e.message); process.exit(1); });
