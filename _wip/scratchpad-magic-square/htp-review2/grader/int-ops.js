const { openHelp } = require('./lib');
const kind = process.argv[2] || 'sp';
const out = kind === 'sp' ? 'sp-ops2' : 'pc-ops';
require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const { browser, page, errors } = await openHelp(kind);
  await page.waitForTimeout(4500);
  await page.getByRole('tab', { name: '操作' }).click();
  await page.waitForTimeout(600);
  const panel = page.locator('[role=tabpanel][data-state=active]');
  const items = panel.locator('li');
  let n = 0;
  const shot = async (name, wait = 600) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/o-${String(n++).padStart(2,'0')}-${name}.png` }); };
  const center = async (loc) => { await loc.evaluate(e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); };
  const tp = async (loc) => kind === 'sp' ? loc.tap() : loc.click();
  const cellsOf = li => li.locator('button[aria-label*="行"]');
  const key = (li, v) => li.locator('button:not([aria-label])').filter({ hasText: new RegExp('^' + v + '$') });
  // item 0: 置き方
  let li = items.nth(0); await center(li.locator('.rounded-lg').first()); await shot('place-initial', 100);
  const c0 = cellsOf(li);
  const labels = await c0.evaluateAll(es => es.map(e => e.getAttribute('aria-label')));
  console.log(labels.join(','));
  await tp(c0.nth(5)); await shot('place-tap-r2c2');
  await tp(key(li, 2)); await shot('place-press2');
  await tp(c0.nth(10)); await shot('place-tap-r3c3');
  await tp(key(li, 12)); await shot('place-press12', 300); await shot('place-press12-1500', 1500);
  // item 1: 置き換え
  li = items.nth(1); await center(li.locator('.rounded-lg').first()); await shot('repl-initial', 100);
  const c1 = cellsOf(li);
  await tp(c1.nth(3)); await shot('repl-tap9');
  await tp(key(li, 16)); await shot('repl-press16');
  await tp(key(li, 16)); await shot('repl-press16again');
  // item 2: メモ
  li = items.nth(2); await center(li.locator('.rounded-lg').first()); await shot('memo-initial', 100);
  const c2 = cellsOf(li);
  const btns = await li.locator('button').evaluateAll(es => es.map(e => (e.getAttribute('aria-label')||'') + ':' + e.innerText.trim() + ':' + e.getAttribute('aria-pressed')));
  console.log(btns.join(' | '));
  await tp(c2.nth(2)); await shot('memo-tapEmpty');
  const pencil = li.getByRole('button', { name: 'メモ', exact: true });
  console.log('pencil label', await pencil.getAttribute('aria-label'));
  await tp(pencil); await shot('memo-pencil-on');
  await tp(key(li, 5)); await shot('memo-5');
  await tp(key(li, 11)); await shot('memo-11');
  await tp(key(li, 2)); await shot('memo-2');
  await tp(key(li, 3)); await shot('memo-3');
  await tp(key(li, 6)); await shot('memo-6-fifth', 80); await shot('memo-6-fifth-settled');
  await tp(key(li, 5)); await shot('memo-5again');
  await tp(pencil); await shot('memo-pencil-off');
  await tp(key(li, 16)); await shot('memo-place16');
  // item 3: メモ消え
  li = items.nth(3); await center(li.locator('.rounded-lg').first()); await shot('mclr-initial', 100);
  const c3 = cellsOf(li);
  await tp(c3.nth(2)); await shot('mclr-tap');
  await tp(key(li, 5)); await shot('mclr-press5', 150); await shot('mclr-press5-settled', 800);
  console.log(errors.join('\n'));
  await browser.close();
})();
