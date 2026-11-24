// スマートフォンで、1つの例を手がかりどおりに変えた後、別の例の上から指で送るだけで、元に戻すボタンが送り始めた例の横へ移るかを確かめる。
// usage: node scroll-test.js <phone|w320> <game> <rules|operations> <panel> <変える例> <送り始める例>
const path = require('path');
const fs = require('fs');
const { chromium, ROOT, openHelp, waitGoalDone, stickyBottom } = require('./lib');
const TABS = { rules: 'ルール', operations: '操作' };

(async () => {
  const [dev, game, tab, pi, changeFig, scrollFig] = process.argv.slice(2);
  const browser = await chromium.launch();
  const { page } = await openHelp(browser, 'after', dev, game);
  await waitGoalDone(page);
  await page.getByRole('tab', { name: TABS[tab] }).click();
  await page.waitForTimeout(500);
  const sticky = await stickyBottom(page);
  const panels = [];
  for (const p of await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]')) {
    if (await p.evaluate((el) => el.getBoundingClientRect().width > 0)) panels.push(p);
  }
  const p = panels[Number(pi)];
  await p.evaluate((el, sticky) => {
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const cs = getComputedStyle(sc);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && sc.scrollHeight > sc.clientHeight + 2) break;
      sc = sc.parentElement;
    }
    sc.scrollTop += el.getBoundingClientRect().top - (sticky + 16);
  }, sticky);
  await page.waitForTimeout(400);
  const hint = await p.evaluate((el, fi) => {
    const h = el.querySelectorAll('figure')[fi].querySelector('[data-how-to-play-press-hint]');
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, Number(changeFig));
  if (hint) {
    await page.touchscreen.tap(hint.x, hint.y);
    await page.waitForTimeout(1000);
  } else {
    const cands = await p.evaluate((el, fi) => [...el.querySelectorAll('figure')[fi].querySelectorAll('button:not([disabled]), [role=button], [role=gridcell]')]
      .map((b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; })
      .filter((c) => c.w > 4), Number(changeFig));
    for (const c of cands) {
      await page.touchscreen.tap(c.x, c.y);
      await page.waitForTimeout(800);
      if (await p.evaluate((el) => !el.querySelector(':scope > span.absolute span').classList.contains('invisible'))) break;
    }
  }
  const state = () => p.evaluate((el) => {
    const s = el.querySelector(':scope > span.absolute');
    const b = s.querySelector('button').getBoundingClientRect();
    const pr = el.getBoundingClientRect();
    return { side: s.getAttribute('data-reset-button-side'), shown: !s.querySelector('span').classList.contains('invisible'), top: Math.round(b.top - pr.top), left: Math.round(b.left - pr.left) };
  });
  const before = await state();
  await page.screenshot({ path: path.join(ROOT, 'shots', game, `scroll-test-${dev}-p${pi}-0.png`) });
  const pt = await p.evaluate((el, fi) => {
    const f = el.querySelectorAll('figure')[fi];
    const cap = f.querySelector('figcaption');
    const r = (cap || f.firstElementChild).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, Number(scrollFig));
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] });
  for (let s = 1; s <= 12; s++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pt.x, y: pt.y - 10 * s }] });
    await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
  const after = await state();
  await page.screenshot({ path: path.join(ROOT, 'shots', game, `scroll-test-${dev}-p${pi}-1.png`) });
  const line = `${game} ${dev} ${tab} p${pi}: change f${changeFig} → ${JSON.stringify(before)}; swipe-scroll from f${scrollFig} caption → ${JSON.stringify(after)}`;
  fs.appendFileSync(path.join(ROOT, 'scroll-test.log'), line + '\n');
  console.log(line);
  await browser.close();
})();
