const { chromium, devices } = require('playwright');
const G = __dirname;
(async () => {
  const mode = process.argv[2] || 'phone';
  const browser = await chromium.launch();
  const ctx = mode === 'phone' ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:5342/puzzles/magic-square');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'メニュー' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: '遊び方' }).click();
  const clip = mode === 'phone' ? { x: 0, y: 80, width: 390, height: 480 } : { x: 0, y: 100, width: 600, height: 680 };
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    await page.screenshot({ path: `${G}/goal/${mode}-play-${String(i).padStart(2, '0')}-t${Date.now() - t0}.png`, clip });
    await page.waitForTimeout(90);
  }
  // replay then press board during playback
  const replay = page.getByRole('button', { name: /見せ直|もう一度|再生/ });
  console.log('replay count', await replay.count(), await replay.first().getAttribute('aria-label').catch(() => ''));
  await replay.first().click();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${G}/goal/${mode}-replay-mid.png`, clip });
  const skip = page.getByRole('button', { name: '埋め終えた姿まで飛ばす' });
  console.log('skip count', await skip.count());
  const bb = await page.locator('[aria-label="ゴールの盤面"]').boundingBox();
  console.log('board bbox', bb);
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${G}/goal/${mode}-after-skip.png`, clip });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${G}/goal/${mode}-after-skip2.png`, clip });
  // Press board after settled
  await page.mouse.click(bb.x + bb.width * 0.3, bb.y + bb.height * 0.3);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${G}/goal/${mode}-press-settled.png`, clip });
  // focus/hover on replay
  await replay.first().hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${G}/goal/${mode}-replay-hover.png`, clip });
  console.log(errors.join('\n'));
  await browser.close();
})();
