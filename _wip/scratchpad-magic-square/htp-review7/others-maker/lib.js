// 遊び方の見直し用の共通の手順（開く・ゴールを待つ・タブを最後まで撮る）。
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BASES = { after: 'http://localhost:5342', before: 'http://localhost:5343' };

function ctxOptions(dev) {
  if (dev === 'phone') {
    const { defaultBrowserType: _b, ...rest } = devices['iPhone 13'];
    return rest;
  }
  if (dev === 'w320') {
    const { defaultBrowserType: _b, ...rest } = devices['iPhone SE'];
    return rest; // 320x568, isMobile, hasTouch
  }
  return { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
}

async function openHelp(browser, version, dev, game) {
  const ctx = await browser.newContext(ctxOptions(dev));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE ' + m.text());
  });
  await page.goto(BASES[version] + '/puzzles/' + game, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^メニュー/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}

async function waitGoalDone(page, timeout = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ok = await page.evaluate(() => {
      const b = document.querySelector('[role=dialog] button[aria-label="始まりの盤面から見せ直す"]');
      return b !== null && !b.disabled;
    });
    if (ok) return Date.now() - start;
    await page.waitForTimeout(250);
  }
  return -1;
}

async function scrollerHandle(page) {
  return page.evaluateHandle(() => {
    const panel = document.querySelector('[role=tabpanel][data-state=active]');
    let el = panel;
    while (el) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) return el;
      el = el.parentElement;
    }
    return document.scrollingElement;
  });
}

/** 上に留まる帯（タブの列）の下端。スマートフォンでは中身がこの裏に隠れる。 */
async function stickyBottom(page) {
  return page.evaluate(() => {
    const list = document.querySelector('[role=dialog] [role=tablist]');
    if (!list) return 0;
    let el = list;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (cs.position === 'sticky' || cs.position === 'fixed') return Math.round(el.getBoundingClientRect().bottom);
      el = el.parentElement;
    }
    return 0;
  });
}

/** 今のタブを最後まで送りながら撮り、つなぐための情報を返す。 */
async function shootTab(page, prefix) {
  const h = await scrollerHandle(page);
  const info = await h.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { sh: el.scrollHeight, ch: el.clientHeight, top: r.top, left: r.left, width: r.width, height: r.height };
  });
  const sticky = await stickyBottom(page);
  const vp = page.viewportSize();
  const clip = {
    x: Math.max(0, info.left),
    y: Math.max(0, info.top),
    width: Math.min(vp.width, info.width),
    height: Math.min(vp.height - Math.max(0, info.top), info.ch),
  };
  const segs = [];
  let y = 0;
  let i = 0;
  for (;;) {
    await h.evaluate((el, y) => { el.scrollTop = y; }, y);
    await page.waitForTimeout(300);
    const actual = await h.evaluate((el) => el.scrollTop);
    const f = `${prefix}-seg${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path: f, clip });
    segs.push({ file: f, scrollTop: actual });
    if (actual + info.ch >= info.sh - 2) break;
    y = actual + Math.max(200, info.ch - 160);
    i++;
    if (i > 40) break;
  }
  await h.evaluate((el) => { el.scrollTop = 0; });
  const meta = { prefix, clip, info, segs, sticky: Math.max(0, sticky - clip.y) };
  fs.writeFileSync(`${prefix}-segs.json`, JSON.stringify(meta));
  return meta;
}

module.exports = { chromium, devices, ROOT, BASES, ctxOptions, openHelp, waitGoalDone, scrollerHandle, stickyBottom, shootTab };
