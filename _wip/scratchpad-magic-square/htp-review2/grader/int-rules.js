const { openHelp } = require('./lib');
const out = 'sp-int';
(async () => {
  const { browser, page, errors } = await openHelp('sp');
  await page.waitForTimeout(5000);
  const panel = page.locator('[role=tabpanel][data-state=active]');
  const sec = i => panel.locator(':scope > div > section').nth(i);
  let n = 0;
  const shot = async (name, wait = 700) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/r-${String(n++).padStart(2,'0')}-${name}.png` }); };
  const center = async (loc) => { await loc.evaluate(e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); };
  // section 0
  const s0 = sec(0);
  const s0cells = s0.locator('button[aria-label*="行"]');
  const s0keys = s0.locator('button:not([aria-label])');
  await center(s0.locator('.rounded-lg').first());
  await shot('s0-initial', 100);
  await s0cells.nth(3).tap(); await shot('s0-tap11');
  await s0keys.filter({ hasText: /^16$/ }).tap(); await shot('s0-press16', 120); await shot('s0-press16-settled');
  await s0cells.nth(6).tap(); await shot('s0-tapEmptyX');
  await s0keys.filter({ hasText: /^2$/ }).tap(); await shot('s0-press2', 120); await shot('s0-press2-settled');
  await s0keys.filter({ hasText: /^14$/ }).tap({ force: true }).catch(e => console.log('14 tap err', e.message.slice(0,80))); await shot('s0-press14used', 120);
  // reset
  const reset = s0.getByRole('button', { name: '例を元に戻す' });
  console.log('reset disabled?', await reset.isDisabled());
  await reset.tap(); await shot('s0-reset');
  // section 1
  const s1 = sec(1);
  const s1cells = s1.locator('button[aria-label*="行"]');
  const s1keys = s1.locator('button:not([aria-label])');
  await center(s1.locator('.rounded-lg').first());
  await shot('s1-initial', 100);
  await s1cells.nth(3).tap(); await shot('s1-tapEmpty');
  await s1keys.filter({ hasText: /^4$/ }).tap({ force: true }).catch(e => console.log('4 err', e.message.slice(0,80))); await shot('s1-press4-60', 60); await shot('s1-press4-settled', 600);
  await s1keys.filter({ hasText: /^11$/ }).tap(); await shot('s1-press11');
  await s1keys.filter({ hasText: /^11$/ }).tap(); await shot('s1-press11again');
  await s1cells.nth(0).tap(); await shot('s1-tap14');
  // section 2
  const s2 = sec(2);
  const s2cells = s2.locator('button[aria-label*="行"]');
  const s2keys = s2.locator('button:not([aria-label])');
  await center(s2.locator('.rounded-lg').first());
  await shot('s2-initial', 100);
  await s2cells.nth(0).tap(); await shot('s2-tapGiven14', 60); await shot('s2-tapGiven14-settled');
  await s2keys.filter({ hasText: /^7$/ }).tap(); await shot('s2-press7-60', 60); await shot('s2-press7-settled');
  await s2cells.nth(2).tap(); await shot('s2-tap5');
  await s2keys.filter({ hasText: /^7$/ }).tap(); await shot('s2-press7onPlaced');
  await s2cells.nth(3).tap(); await shot('s2-tapEmpty');
  await s2keys.filter({ hasText: /^9$/ }).tap(); await shot('s2-press9');
  console.log(errors.join('\n'));
  await browser.close();
})();
