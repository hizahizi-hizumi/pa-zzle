// 探す手順で、最初から置いてある数のマスと置いた数のマスを押したときの反応を確かめる。
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
  await page.goto('http://127.0.0.1:5342/puzzles/magic-square/tutorial');
  await page.waitForTimeout(1500);
  const dialog = page.getByRole('dialog', { name: '魔方陣' });
  await dialog.getByRole('button', { name: 'はじめる' }).tap();
  await page.waitForTimeout(2000);
  const cell = (r, c) => dialog.locator(`button[aria-label^="${r}行${c}列 "]`);
  const num = (v) => dialog.getByRole('group', { name: '数の欄' }).getByRole('button', { name: String(v), exact: true });
  for (const [r, c, v] of [[1, 1, 14], [1, 4, 11], [3, 1, 8], [2, 2, 2]]) {
    await cell(r, c).tap(); await page.waitForTimeout(120); await num(v).tap(); await page.waitForTimeout(1100);
  }
  const snap = async (label) => {
    const html = await dialog.evaluate((root) => ({
      msg: root.querySelector('[aria-live=polite] p').innerText.replace(/\n/g, ' / '),
      pressed: [...root.querySelectorAll('button[aria-pressed=true]')].map((b) => b.getAttribute('aria-label') || b.textContent),
      cues: root.querySelectorAll('[data-tutorial-cue]').length,
      anims: document.getAnimations().filter((a) => a.playState === 'running').length,
    }));
    console.log(label, JSON.stringify(html));
    await page.screenshot({ path: `shots/extra3/search-${label}.png` });
  };
  await snap('before');
  await cell(1, 2).tap(); await page.waitForTimeout(60);
  await snap('tap-given-1-2');
  await cell(1, 1).tap(); await page.waitForTimeout(60);
  await snap('tap-placed-1-1');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
