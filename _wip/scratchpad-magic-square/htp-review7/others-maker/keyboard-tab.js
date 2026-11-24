// PC で左の例を押して変えた後、Tab でフォーカスを右の例へ送るだけで、元に戻すボタンが右の例の横へ移るかを確かめる。
// usage: node keyboard-tab.js <game> <panel>
const path = require('path');
const fs = require('fs');
const { chromium, ROOT, openHelp, waitGoalDone } = require('./lib');

(async () => {
  const [game, pi] = process.argv.slice(2);
  const browser = await chromium.launch();
  const { page } = await openHelp(browser, 'after', 'pc', game);
  await waitGoalDone(page);
  const panels = [];
  for (const p of await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]')) {
    if (await p.evaluate((el) => el.getBoundingClientRect().width > 0)) panels.push(p);
  }
  const p = panels[Number(pi)];
  await p.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const hint = await p.evaluate((el) => {
    const h = el.querySelectorAll('figure')[0].querySelector('[data-how-to-play-press-hint]');
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(hint.x, hint.y);
  await page.waitForTimeout(900);
  const state = () => p.evaluate((el) => {
    const s = el.querySelector(':scope > span.absolute');
    const figs = [...el.querySelectorAll('figure')];
    const active = document.activeElement;
    return {
      side: s.getAttribute('data-reset-button-side'),
      shown: !s.querySelector('span').classList.contains('invisible'),
      focusFig: figs.findIndex((f) => f.contains(active)),
      focus: (active.getAttribute('aria-label') || active.tagName).slice(0, 30),
    };
  });
  const log = [`after click f0: ${JSON.stringify(await state())}`];
  await page.screenshot({ path: path.join(ROOT, 'shots', game, 'keyboard-tab-0.png') });
  for (let i = 1; i <= 8; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    const s = await state();
    log.push(`Tab ${i}: ${JSON.stringify(s)}`);
    if (s.focusFig === 1) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(400);
      log.push(`Tab ${i + 1}: ${JSON.stringify(await state())}`);
      await page.screenshot({ path: path.join(ROOT, 'shots', game, 'keyboard-tab-1.png') });
      break;
    }
  }
  fs.writeFileSync(path.join(ROOT, 'shots', game, 'keyboard-tab-log.txt'), log.join('\n'));
  console.log(log.join('\n'));
  await browser.close();
})();
