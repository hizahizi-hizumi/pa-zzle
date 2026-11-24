// 構造の下見: node explore.js <version> <dev> <game>
const { chromium, openHelp, waitGoalDone, stickyBottom } = require('./lib');
(async () => {
  const [version, dev, game] = process.argv.slice(2);
  const browser = await chromium.launch();
  const { page, errors } = await openHelp(browser, version, dev, game);
  console.log('goal wait', await waitGoalDone(page));
  console.log('sticky', await stickyBottom(page));
  for (const tab of ['ルール', '操作']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const out = [];
      for (const p of document.querySelectorAll('[role=tabpanel][data-state=active] [data-reset-button-placement]')) {
        const r = p.getBoundingClientRect();
        const figs = [...p.querySelectorAll('figure')];
        out.push({
          placement: p.getAttribute('data-reset-button-placement'),
          h: Math.round(r.height), w: Math.round(r.width),
          figs: figs.map((f) => { const fr = f.getBoundingClientRect(); const b = f.firstElementChild.getBoundingClientRect(); return [Math.round(fr.left - r.left), Math.round(fr.top - r.top), Math.round(fr.width), Math.round(fr.height), 'board', Math.round(b.left - r.left), Math.round(b.width), f.parentElement.closest('figure') ? 'NESTED' : '', f.querySelectorAll('[data-how-to-play-press-hint]').length]; }),
          heading: p.parentElement.querySelector('h3,h4')?.textContent.slice(0, 30),
        });
      }
      return out;
    });
    console.log(tab, JSON.stringify(info, null, 0));
  }
  console.log('errors', errors);
  await browser.close();
})();
