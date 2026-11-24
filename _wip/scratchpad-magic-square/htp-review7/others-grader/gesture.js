// node gesture.js <ver> <game> <dev> <tab> <plan-json>
// plan: [{pi, fi, kind:'swipe'|'tapmid'|'tap', dx, dy, a, b}]
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const [ver, game, dev, tab, planJson, tag] = process.argv.slice(2);
  const plan = JSON.parse(planJson);
  const port = ver === 'after' ? 5342 : 5343;
  const OUT = path.join(__dirname, 'gest', game, dev); fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const opts = dev === 'sp' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } };
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/puzzles/${game}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: opts.viewport.width, height: 7000 });
  await page.waitForTimeout(500);
  await page.getByRole('tab', { name: tab }).click();
  await page.waitForTimeout(700);
  const cdp = dev === 'sp' ? await ctx.newCDPSession(page) : null;
  async function swipe(x, y, dx, dy) {
    const steps = 8;
    if (cdp) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps }] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= steps; i++) { await page.mouse.move(x + dx * i / steps, y + dy * i / steps); await page.waitForTimeout(16); }
      await page.mouse.up();
    }
  }
  const log = [];
  let n = 0;
  for (const st of plan) {
    const pt = await page.evaluate((st) => {
      const p = document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')[st.pi];
      p.scrollIntoView({ block: 'center' });
      const fig = p.querySelectorAll('figure')[st.fi];
      if (st.kind === 'tapmid') {
        const bs = [...fig.querySelectorAll('button')];
        const r1 = bs[st.a].getBoundingClientRect(), r2 = bs[st.b].getBoundingClientRect();
        return { x: (r1.x + r1.width / 2 + r2.x + r2.width / 2) / 2, y: (r1.y + r1.height / 2 + r2.y + r2.height / 2) / 2 };
      }
      const hint = fig.querySelector('[data-how-to-play-press-hint]');
      const r = (hint || fig).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, st);
    if (st.kind === 'swipe') await swipe(pt.x, pt.y, st.dx || 0, st.dy || 0);
    else if (dev === 'sp') await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(1600);
    const info = await page.evaluate((pi) => {
      const p = document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')[pi];
      const b = [...p.querySelectorAll('button')].find(b => /元に戻す/.test(b.getAttribute('aria-label') || ''));
      const pr = p.getBoundingClientRect(); const br = b.getBoundingClientRect();
      return { place: p.dataset.resetButtonPlacement, enabled: !b.disabled, btn: [Math.round(br.x - pr.x), Math.round(br.y - pr.y)], panelW: Math.round(pr.width) };
    }, st.pi);
    log.push({ st, info });
    const h = await page.evaluateHandle((pi) => { const p = document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')[pi]; return p.closest('section') || p.parentElement; }, st.pi);
    await h.asElement().screenshot({ path: path.join(OUT, `${tag || 'g'}-${ver}-${n++}.png`), scale: 'css' });
  }
  console.log(JSON.stringify(log));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
