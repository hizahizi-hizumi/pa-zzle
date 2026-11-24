const L = require('./lib');
(async () => {
  const [version, game, dev] = process.argv.slice(2);
  const browser = await L.chromium.launch();
  const { page, errors } = await L.openHelp(version, dev, game, browser);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${L.OUT}/explore-${game}-${version}-${dev}-open.png` });
  const info = await page.evaluate(() => {
    const out = {};
    out.tabs = [...document.querySelectorAll('[role=tab]')].map(t => t.textContent);
    out.panels = [...document.querySelectorAll('[data-reset-button-placement], .rounded-lg')].filter(p => p.closest('[role=dialog]')).map(p => {
      const r = p.getBoundingClientRect();
      const tp = p.closest('[role=tabpanel]');
      const inter = [...p.querySelectorAll('button,[role=button],[role=gridcell],[tabindex]')].slice(0, 12).map(e => {
        const rr = e.getBoundingClientRect();
        return `${e.tagName}:${e.getAttribute('role')||''}:${(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,30)}@${Math.round(rr.x)},${Math.round(rr.y)},${Math.round(rr.width)}x${Math.round(rr.height)}`;
      });
      return { tab: tp ? tp.id.split('-').pop() : 'none', place: p.getAttribute('data-reset-button-placement'), cls: p.className.slice(0, 80), box: [r.x, r.y, r.width, r.height].map(Math.round), n: p.querySelectorAll('button,[role=button],[role=gridcell],[tabindex]').length, inter };
    });
    out.headings = [...document.querySelectorAll('[role=dialog] h2,[role=dialog] h3,[role=dialog] h4')].map(h => `${h.tagName} ${getComputedStyle(h).fontSize}/${getComputedStyle(h).fontWeight} ${h.textContent.slice(0,40)}`);
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  console.log(errors.join('\n'));
  await browser.close();
})();
