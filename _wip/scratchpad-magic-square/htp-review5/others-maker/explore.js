const { chromium, openHelp, waitGoalDone } = require('./lib');
(async () => {
  const [version, dev, game] = process.argv.slice(2);
  const browser = await chromium.launch();
  const { ctx, page, errors } = await openHelp(browser, version, dev, game);
  console.log('goal wait', await waitGoalDone(page));
  for (const tab of ['ルール', '操作', '採点']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(400);
    const out = await page.evaluate(() => {
      const panel = document.querySelector('[role=tabpanel][data-state=active]');
      const res = [];
      const walk = (el, depth) => {
        if (depth > 14) return;
        const tag = el.tagName.toLowerCase();
        const cls = (el.getAttribute('class') || '').slice(0, 90);
        const r = el.getBoundingClientRect();
        const attrs = [...el.attributes].filter(a => a.name.startsWith('data-') || a.name === 'aria-label' || a.name === 'inert').map(a => `${a.name}=${a.value}`).join(' ');
        const interesting = /^(h\d|section|figure|figcaption|ul|li|p|table)$/.test(tag) || attrs.includes('data-reset') || /rounded-lg/.test(cls) || attrs.includes('inert');
        if (interesting) {
          const txt = (tag.match(/^(h\d|p|figcaption|li)$/) ? el.textContent.slice(0, 50) : '');
          res.push(`${'  '.repeat(depth)}${tag} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] ${attrs} {${cls}} ${txt}`);
        }
        for (const c of el.children) walk(c, depth + (interesting ? 1 : 0));
      };
      walk(panel, 0);
      return res.join('\n');
    });
    console.log('=== TAB', tab);
    console.log(out);
  }
  console.log(errors);
  await browser.close();
})();
