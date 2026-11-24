// usage: node capture.js <after|before> <phone|pc> <game>
const fs = require('fs');
const L = require('./lib');

const [version, dev, game] = process.argv.slice(2);
const dir = `${L.OUT}/${game}/${dev}/${version}`;
fs.mkdirSync(dir, { recursive: true });
const report = { version, dev, game, tabs: {}, panels: [], goal: {}, errors: [] };

async function measureTab(page) {
  return page.evaluate(() => {
    const tp = document.querySelector('[role=tabpanel][data-state=active]');
    const fs = (el) => { const c = getComputedStyle(el); return `${c.fontSize}/${c.fontWeight}`; };
    const heads = [...tp.querySelectorAll('h2,h3,h4')].map(h => `${h.tagName} ${fs(h)} ${h.textContent.trim().slice(0, 50)}`);
    const paras = [...tp.querySelectorAll('p')].slice(0, 40).map(p => `${fs(p)} ${p.textContent.trim().slice(0, 50)}`);
    const flows = [...tp.querySelectorAll('div.border, div[class*="border"]')].filter(d => d.querySelector('figure')).map(d => {
      const c = getComputedStyle(d); const r = d.getBoundingClientRect();
      return { bg: c.backgroundColor, border: `${c.borderTopWidth} ${c.borderTopColor}`, pad: `${c.paddingTop} ${c.paddingRight} ${c.paddingBottom} ${c.paddingLeft}`, w: Math.round(r.width), h: Math.round(r.height) };
    });
    return { heads, paras, flows };
  });
}

async function panelInfo(page, idx) {
  return page.evaluate((idx) => {
    const tp = document.querySelector('[role=tabpanel][data-state=active]');
    const p = [...tp.querySelectorAll('[data-reset-button-placement]')][idx];
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const c = getComputedStyle(p);
    const reset = p.querySelector('button[aria-label="例を元に戻す"]');
    let rb = null;
    if (reset) {
      const b = reset.getBoundingClientRect();
      rb = { visible: getComputedStyle(reset.parentElement).visibility !== 'hidden', enabled: !reset.disabled, right: Math.round(r.right - b.right), top: Math.round(b.top - r.top), bottom: Math.round(r.bottom - b.bottom) };
    }
    const sec = p.closest('section');
    const heading = sec ? (sec.querySelector('h3,h4')?.textContent || '').trim() : '';
    const figs = p.querySelectorAll('figure').length;
    const caps = [...p.querySelectorAll('figcaption')].map(f => f.textContent.trim().slice(0, 40));
    return { heading: heading.slice(0, 60), placement: p.getAttribute('data-reset-button-placement'), pad: `${c.paddingTop}/${c.paddingBottom}`, w: Math.round(r.width), h: Math.round(r.height), figs, caps, reset: rb, hints: p.querySelectorAll('[data-how-to-play-press-hint]').length };
  }, idx);
}

async function clipPanel(page, handle, file) {
  await handle.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
  const b = await handle.boundingBox();
  if (!b) return;
  const vp = page.viewportSize();
  const x = Math.max(0, b.x - 8), y = Math.max(0, b.y - 48);
  const w = Math.min(vp.width - x, b.width + 16), h = Math.min(vp.height - y, b.height + 56);
  if (w > 0 && h > 0) await page.screenshot({ path: file, clip: { x, y, width: w, height: h } });
}

async function pressPanel(page, tab, idx) {
  const handles = await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]');
  const h = handles[idx];
  if (!h) return;
  const before = await panelInfo(page, idx);
  await clipPanel(page, h, `${dir}/${tab}-p${idx}-a.png`);
  const heading = before ? before.heading : '';
  const right = /右クリック/.test(heading);
  const steps = [];
  for (let round = 0; round < 5; round++) {
    const hint = await h.$('[data-how-to-play-press-hint]');
    let target;
    if (hint) {
      await hint.evaluate(el => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(250);
      const hb = await hint.boundingBox();
      const vp = page.viewportSize();
      if (!hb || hb.y + hb.height / 2 < 120 || hb.y + hb.height / 2 > vp.height - 4) { steps.push('hint-offscreen'); break; }
      if (hb && hb.width > 0) target = { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2, kind: 'hint' };
    }
    if (!target) {
      if (round > 0) break;
      // no hint: press first interactive thing inside a figure
      const btn = await h.$('figure button, figure [role=group]');
      if (!btn) break;
      const bb = await btn.boundingBox();
      if (!bb || bb.width === 0) break;
      target = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, kind: 'first' };
    }
    await page.mouse.click(target.x, target.y, { button: right ? 'right' : 'left' });
    steps.push(target.kind);
    await page.waitForTimeout(900);
    if (round === 0) await clipPanel(page, h, `${dir}/${tab}-p${idx}-b.png`);
  }
  await page.waitForTimeout(600);
  await clipPanel(page, h, `${dir}/${tab}-p${idx}-c.png`);
  const after = await panelInfo(page, idx);
  // reset
  const reset = await h.$('button[aria-label="例を元に戻す"]:not([disabled])');
  let resetOk = null;
  if (reset) {
    await reset.click();
    await page.waitForTimeout(700);
    const again = await panelInfo(page, idx);
    resetOk = again && again.reset ? !again.reset.visible : null;
  }
  report.panels.push({ tab, idx, before, after, steps, resetOk });
}

(async () => {
  const browser = await L.chromium.launch();
  const { page, errors } = await L.openHelp(version, dev, game, browser);
  await page.screenshot({ path: `${dir}/open0.png` });
  // wait for goal animation
  for (let i = 0; i < 24; i++) {
    const ok = await page.$('button[aria-label$="見せ直す"]:not([disabled])');
    if (ok) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/open1.png` });
  report.goal = await page.evaluate(() => {
    const rb = document.querySelector('button[aria-label$="見せ直す"]');
    const tb = [...document.querySelectorAll('[role=dialog] button')].find(b => /チュートリアル/.test(b.textContent));
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); };
    const frame = rb ? rb.parentElement.parentElement.parentElement : null;
    const board = frame ? frame.firstElementChild : null;
    return { replay: box(rb), tutorial: box(tb), frame: box(frame), board: box(board) };
  });
  const tabs = ['rules', 'operations', 'scoring'];
  const tabLabels = { rules: 'ルール', operations: '操作', scoring: '採点' };
  for (const tab of tabs) {
    try {
      await page.getByRole('tab', { name: tabLabels[tab] }).click({ timeout: 5000 });
    } catch (e) {
      await page.screenshot({ path: `${dir}/debug-tab-${tab}.png` });
      const blocker = await page.evaluate(() => {
        const t = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.includes('操作'));
        const r = t.getBoundingClientRect();
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el ? `${el.tagName}.${el.className}`.slice(0, 200) + ' role=' + el.getAttribute('role') : 'none';
      });
      report.errors.push(`tab click ${tab} blocked by ${blocker}`);
      await page.getByRole('tab', { name: tabLabels[tab] }).click({ force: true });
    }
    await page.waitForTimeout(600);
    const s = await L.shootScroll(page, `${dir}/${tab}`);
    report.tabs[tab] = { scroll: s.info, shots: s.files.length, ...(await measureTab(page)) };
    const n = await page.$$eval('[role=tabpanel][data-state=active] [data-reset-button-placement]', ps => ps.length);
    for (let i = 0; i < n; i++) {
      try { await pressPanel(page, tab, i); } catch (e) { report.errors.push(`press ${tab} ${i}: ${e.message.split('\n')[0]}`); }
    }
    if (tab !== 'rules') {
      // element shots of top-level sections
      const secs = await page.$$('[role=tabpanel][data-state=active] > div > *');
      for (let i = 0; i < secs.length; i++) {
        try { await secs[i].screenshot({ path: `${dir}/${tab}-sec${i}.png`, timeout: 4000 }); } catch (e) { report.errors.push(`sec ${tab} ${i}: ${e.message.split('\n')[0]}`); }
      }
    }
  }
  // replay goal
  await page.getByRole('tab', { name: 'ルール' }).click();
  await page.waitForTimeout(400);
  const replay = await page.$('button[aria-label$="見せ直す"]:not([disabled])');
  if (replay) {
    await replay.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await replay.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${dir}/replay-mid.png` });
  }
  report.errors.push(...errors);
  fs.writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 1));
  await browser.close();
  console.log(`done ${game} ${dev} ${version} panels=${report.panels.length} errors=${report.errors.length}`);
})().catch(e => { console.error('FAIL', game, dev, version, e.message); process.exit(1); });
