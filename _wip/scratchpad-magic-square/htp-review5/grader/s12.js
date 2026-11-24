const { open, tab, G } = require('./lib');
(async () => {
  const { browser, page } = await open('phone');
  await tab(page, '採点');
  const r = await page.evaluate(() => {
    const p = [...document.querySelectorAll('[role=tabpanel]')].find(e => e.getAttribute('data-state') === 'active');
    const fig = p.querySelector('figure');
    const box = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left*10)/10, Math.round(r.top*10)/10, Math.round(r.right*10)/10, Math.round(r.bottom*10)/10]; };
    const out = { figure: box(fig) };
    // find board frames (elements with role img or the slab) : take descendants with width between 40 and 120 and height > 150
    out.strips = [...fig.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 150 && r.width > 30 && r.width < 80; }).slice(0, 6).map(e => [e.tagName, String(e.className).slice(0, 40), box(e)]);
    out.labels = [...fig.querySelectorAll('span')].filter(e => /を$|置く/.test(e.innerText)).map(e => [e.innerText, box(e)]);
    out.arrows = [...fig.querySelectorAll('svg')].map(box).slice(0, 4);
    out.caption = [...fig.querySelectorAll('figcaption, figcaption *')].slice(0, 6).map(e => [e.tagName, e.innerText.replace(/\n/g, '/').slice(0, 30), box(e)]);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
