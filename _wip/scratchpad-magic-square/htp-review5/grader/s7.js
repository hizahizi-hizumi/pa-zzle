const { open, tab, G } = require('./lib');
const mode = process.argv[2] || 'phone';
(async () => {
  const { browser, page, errors } = await open(mode);
  const act = async (fn) => (mode === 'phone' ? fn.tap() : fn.click());
  let n = 0;
  const panelsOf = () => page.locator('[role=tabpanel][data-state=active] div.rounded-lg.bg-muted');
  async function shot(panel, label, full = false) {
    const name = `${G}/touch2/${mode}-${String(n++).padStart(2, '0')}-${label}.png`;
    if (full) await page.screenshot({ path: name }); else await panel.screenshot({ path: name });
  }
  const cell = (panel, rc) => panel.getByRole('button', { name: new RegExp('^' + rc) }).first();
  const num = (panel, v, idx = 0) => panel.getByRole('button', { name: String(v), exact: true }).nth(idx);
  async function list(panel) { return panel.getByRole('button').evaluateAll(bs => bs.map(b => (b.getAttribute('aria-label') || b.innerText) + (b.disabled ? '(disabled)' : '') + (b.getAttribute('aria-pressed') ? `[pressed=${b.getAttribute('aria-pressed')}]` : ''))); }

  await tab(page, 'ルール');
  let ps = panelsOf();
  console.log('rules panels', await ps.count());
  // P0 line
  let p = ps.nth(0);
  await p.scrollIntoViewIfNeeded();
  console.log('P0 buttons', (await list(p)).join(' | '));
  await shot(p, 'line-initial');
  await act(cell(p, '1行4列'));
  await page.waitForTimeout(300); await shot(p, 'line-sel-11');
  await act(num(p, 12));
  await page.waitForTimeout(500); await shot(p, 'line-put12');
  await page.waitForTimeout(800); await shot(p, 'line-put12-later', true);
  // board 2: select empty 1行3列 then 2
  await act(p.getByRole('button', { name: /^1行3列/ }).nth(1));
  await page.waitForTimeout(300); await shot(p, 'line-b2-sel');
  await act(num(p, 2, 1));
  await page.waitForTimeout(600); await shot(p, 'line-b2-put2');
  // press a used value on board 2 (4) -> rejected?
  await act(num(p, 4, 1)).catch(e => console.log('tap 4 fail', e.message.slice(0, 80)));
  await page.waitForTimeout(120); await shot(p, 'line-b2-press-used4-mid');
  await page.waitForTimeout(600);
  // reset button
  const reset = p.getByRole('button', { name: '例を元に戻す' });
  console.log('reset visible', await reset.isVisible());
  await shot(p, 'line-with-reset');

  // P1 used values
  p = ps.nth(1); await p.scrollIntoViewIfNeeded();
  await shot(p, 'used-initial');
  await act(cell(p, '1行4列')); await page.waitForTimeout(300); await shot(p, 'used-sel');
  await act(num(p, 11)); await page.waitForTimeout(400); await shot(p, 'used-put11');
  await act(cell(p, '1行1列')); await page.waitForTimeout(400); await shot(p, 'used-sel-other');
  await act(num(p, 4)).catch(e => console.log('tap used 4 fail', e.message.slice(0, 80)));
  await page.waitForTimeout(150); await shot(p, 'used-press4-mid');

  // P2 given
  p = ps.nth(2); await p.scrollIntoViewIfNeeded();
  await shot(p, 'given-initial');
  await act(cell(p, '1行1列')); await page.waitForTimeout(300); await shot(p, 'given-sel14');
  await act(num(p, 6)); await page.waitForTimeout(100); await shot(p, 'given-press6-mid');
  await page.waitForTimeout(600); await shot(p, 'given-press6-after');
  await act(cell(p, '1行3列')); await page.waitForTimeout(300); await shot(p, 'given-sel5');
  await act(num(p, 6)); await page.waitForTimeout(500); await shot(p, 'given-5to6');

  // Operations
  await tab(page, '操作');
  ps = panelsOf();
  console.log('op panels', await ps.count());
  p = ps.nth(0); await p.scrollIntoViewIfNeeded();
  await act(cell(p, '2行2列')); await page.waitForTimeout(300); await shot(p, 'place-sel');
  await act(num(p, 2)); await page.waitForTimeout(500); await shot(p, 'place-put2');
  await act(cell(p, '3行3列')); await page.waitForTimeout(300); await shot(p, 'place-sel33');
  await act(num(p, 12));
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(250); await shot(p, 'place-clear-' + i); }
  await page.waitForTimeout(1500); await shot(p, 'place-cleared-final');
  console.log('P0 after clear', (await list(p)).slice(-20).join(' | '));

  p = ps.nth(1); await p.scrollIntoViewIfNeeded();
  await act(cell(p, '1行4列')); await page.waitForTimeout(300); await shot(p, 'replace-sel');
  await act(num(p, 11)); await page.waitForTimeout(400); await shot(p, 'replace-11');
  await act(num(p, 11)); await page.waitForTimeout(400); await shot(p, 'replace-remove');

  p = ps.nth(2); await p.scrollIntoViewIfNeeded();
  console.log('memo buttons', (await list(p)).join(' | '));
  await act(cell(p, '1行3列')); await page.waitForTimeout(300); await shot(p, 'memo-sel');
  await act(p.getByRole('button', { name: 'メモ', exact: true })); await page.waitForTimeout(300); await shot(p, 'memo-on');
  await act(num(p, 5)); await page.waitForTimeout(300); await shot(p, 'memo-5');
  await act(num(p, 5)); await page.waitForTimeout(300); await shot(p, 'memo-5-off');
  for (const v of [1, 2, 3, 5]) { await act(num(p, v)); await page.waitForTimeout(150); }
  await shot(p, 'memo-4');
  await act(num(p, 6)); await page.waitForTimeout(120); await shot(p, 'memo-5th-mid');
  await page.waitForTimeout(600); await shot(p, 'memo-5th-after');
  await act(p.getByRole('button', { name: 'メモ', exact: true })); await page.waitForTimeout(300); await shot(p, 'memo-off');
  await act(p.getByRole('button', { name: '待った', exact: true })); await page.waitForTimeout(300); await shot(p, 'memo-undo');

  p = ps.nth(3); await p.scrollIntoViewIfNeeded();
  await act(cell(p, '1行3列')); await page.waitForTimeout(300); await shot(p, 'memoclr-sel');
  await act(num(p, 5)); await page.waitForTimeout(500); await shot(p, 'memoclr-put5');

  console.log(errors.join('\n'));
  await browser.close();
})();
