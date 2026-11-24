const { openHelp } = require('./lib');
(async () => {
  const { browser, page, errors } = await openHelp('pc');
  await page.waitForTimeout(5000);
  for (const tab of ['ルール', '操作', '採点']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(600);
    const info = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      const res = [];
      d.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') ) {
          const r = el.getBoundingClientRect();
          res.push(`${el.tagName} role=${el.getAttribute('role')} state=${el.getAttribute('data-state')} rect=${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)} sh=${el.scrollHeight} ch=${el.clientHeight} cls=${el.className.slice(0,80)}`);
        }
      });
      return res;
    });
    console.log(tab); console.log(info.join('\n'));
  }
  await browser.close();
})();
