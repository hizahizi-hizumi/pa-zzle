const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const [name, ctxOpt] of [['pc', { viewport: { width: 1280, height: 800 } }], ['iphone', devices['iPhone 13']], ['w320', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const ctx = await browser.newContext(ctxOpt);
    const page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /ランダムに遊ぶ/ }).click();
    await page.waitForTimeout(1500);
    const prod = await page.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.width*10)/10, Math.round(b.height*10)/10]; };
      const cell = document.querySelector('[role=group][aria-label="魔方陣の盤面"] button');
      const tab = document.querySelector('[role=group][aria-label="盤面の下に並んだ数"] button');
      return { cell: r(cell), tablet: r(tab) };
    });
    await page.getByRole('button', { name: 'その他の操作' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('menuitem', { name: '遊び方' }).click();
    await page.waitForTimeout(1500);
    const help = await page.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.width*10)/10, Math.round(b.height*10)/10]; };
      const dlg = document.querySelector('[role=dialog]');
      const goalCell = dlg.querySelector('[role=img] button');
      const panel = dlg.querySelector('[role=tabpanel][data-state=active]');
      const exCell = panel.querySelector('[role=group][aria-label="魔方陣の盤面"] button');
      const exTab = panel.querySelector('[role=group][aria-label="盤面の下に並んだ数"] button');
      const scoring = [...dlg.querySelectorAll('[role=tabpanel]')][2];
      const flowCell = scoring.querySelector('[role=group][aria-label="魔方陣の盤面"] button');
      // overflow check
      const over = [...dlg.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > window.innerWidth + 0.5 || b.left < -0.5) && getComputedStyle(e).visibility !== 'hidden'; }).slice(0,5).map(e => e.tagName + '.' + (e.getAttribute('aria-label')||e.className.toString().slice(0,40)));
      return { goalCell: r(goalCell), exCell: r(exCell), exTablet: r(exTab), flowCell: r(flowCell), over };
    });
    console.log(name, JSON.stringify({ prod, help }));
    await ctx.close();
  }
  await browser.close();
})();
