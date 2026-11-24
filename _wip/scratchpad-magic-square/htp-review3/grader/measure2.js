const { openHelp } = require('./lib');
(async () => {
  const { browser, page } = await openHelp('sp', { wait: 1200 });
  await page.getByRole('tab', { name: '操作' }).click();
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const panel = document.querySelector('[role=tabpanel][data-state=active]');
    const p = [...panel.querySelectorAll('p')].find((e) => e.textContent.includes('0に戻して'));
    const chain = [];
    let x = p;
    while (x && x !== panel) {
      const cs = getComputedStyle(x);
      const r = x.getBoundingClientRect();
      chain.push(`${x.tagName} [${(x.className || '').toString().slice(0, 70)}] ${Math.round(r.x)}-${Math.round(r.right)} pad=${cs.paddingLeft}/${cs.paddingRight} shadow=${cs.boxShadow !== 'none'} bg=${cs.backgroundColor}`);
      x = x.parentElement;
    }
    const spans = [...p.querySelectorAll('span')].map((s) => Math.round(s.getBoundingClientRect().right));
    // undo row and "..." row icon centers
    const btn = panel.querySelector('[data-slot=button], button[aria-label]');
    const icons = [...panel.querySelectorAll('svg')].map((s) => { const r = s.getBoundingClientRect(); return [Math.round((r.x + r.right) / 2), Math.round(r.y), Math.round(r.width)]; }).filter((a) => a[1] > 0);
    return { chain, maxSpanRight: Math.max(...spans), icons: icons.slice(-8) };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
