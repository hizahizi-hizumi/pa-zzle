const { openHelp } = require('./lib');
const { panels, shotPanel } = require('./lib2');
// Clicks inside a panel by board cell aria-label or pad key text
async function clickCell(panel, label, nth = 0) {
  const b = await panel.$$(`button[aria-label="${label}"]`);
  await b[nth].click();
}
async function clickKey(panel, text, nth = 0) {
  const bs = await panel.$$('button:not([aria-label])');
  const m = [];
  for (const b of bs) { if ((await b.textContent()).trim() === String(text)) m.push(b); }
  await m[nth].click({ force: true });
}
(async () => {
  const kind = process.argv[2] || 'sp';
  const { browser, page, errs } = await openHelp(kind, { wait: 1200 });
  const ps = await panels(page);
  const snap = async (p, name, times) => {
    let t0 = Date.now();
    for (const t of times) { const w = t - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w); await shotPanel(page, p, `${kind}-wrong-${name}-${t}`); }
  };
  // Rule1 ✓ example: press 11 then 11 again (remove)
  let p = ps[0];
  await p.scrollIntoViewIfNeeded();
  await clickCell(p, '1行4列 11');
  await page.waitForTimeout(200);
  await clickKey(p, 11, 0);
  await snap(p, 'r1-remove11', [80, 700]);
  // Rule1 ✕ example: select empty cell, press 1
  await clickCell(p, '1行3列 空き');
  await page.waitForTimeout(200);
  await clickKey(p, 1, 1);
  await snap(p, 'r1x-place1', [80, 700]);
  // reset
  await page.locator('[aria-label="例を元に戻す"]').nth(0).click();
  await snap(p, 'r1-after-reset', [80, 700]);
  // Rule2: select empty, press used 4
  p = ps[1];
  await p.scrollIntoViewIfNeeded();
  await clickCell(p, '1行4列 空き');
  await page.waitForTimeout(250);
  await clickKey(p, 4, 0);
  await snap(p, 'r2-used4', [40, 120, 250, 800]);
  // Rule3: select given 4 (1行2列), press 6
  p = ps[2];
  await p.scrollIntoViewIfNeeded();
  await clickCell(p, '1行2列 4');
  await page.waitForTimeout(250);
  await snap(p, 'r3-select4', [0]);
  await clickKey(p, 6, 0);
  await snap(p, 'r3-given-6', [40, 120, 250, 800]);
  // Rule3: select placed 5 and press 6 -> replace
  await clickCell(p, '1行3列 5');
  await page.waitForTimeout(250);
  await clickKey(p, 6, 0);
  await snap(p, 'r3-placed-6', [80, 800]);
  console.log(errs.join('\n'));
  await browser.close();
})();
