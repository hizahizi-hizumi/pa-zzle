const { open, tab, G } = require('./lib');
(async () => {
  const { browser, page } = await open('phone');
  const targets = [
    ['採点', '置き直し 1回', 'zcheck-s-count'],
    ['ルール', 'そろう', 'zcheck-r-verdict'],
  ];
  for (const [t, text, name] of targets) {
    await tab(page, t);
    const ok = await page.evaluate((text) => {
      const s = document.querySelector('[role=dialog] .scroll-pt-11');
      const bar = s.querySelector('.sticky').getBoundingClientRect();
      const p = [...document.querySelectorAll('[role=tabpanel]')].find(e => e.getAttribute('data-state') === 'active');
      const el = [...p.querySelectorAll('span,p,figcaption')].find(e => e.innerText && e.innerText.replace(/\s+/g, ' ').includes(text) && e.children.length < 4);
      if (!el) return 'notfound';
      const r = el.getBoundingClientRect();
      s.scrollTop += r.top - (bar.bottom - 8);
      return [r.top, bar.bottom, el.tagName];
    }, text);
    console.log(name, ok);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${G}/${name}.png`, clip: { x: 0, y: 40, width: 390, height: 100 } });
  }
  // hint hand under tab bar: line example hint on 11
  await tab(page, 'ルール');
  await page.evaluate(() => {
    const s = document.querySelector('[role=dialog] .scroll-pt-11');
    const bar = s.querySelector('.sticky').getBoundingClientRect();
    const hand = [...document.querySelectorAll('[role=tabpanel][data-state=active] svg')].map(e => e.getBoundingClientRect()).filter(r => r.width > 10);
    const cell = [...document.querySelectorAll('[role=tabpanel][data-state=active] button')].find(b => (b.getAttribute('aria-label') || '').startsWith('1行4列'));
    const r = cell.getBoundingClientRect();
    s.scrollTop += r.bottom - (bar.bottom + 2);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${G}/zcheck-hint.png`, clip: { x: 0, y: 40, width: 390, height: 100 } });
  await browser.close();
})();
