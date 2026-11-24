const { openHelp, OUT } = require('./lib');
(async () => {
  for (const kind of ['sp', 'pc']) {
    const { browser, page, errs } = await openHelp(kind, { wait: 1500 });
    const goal = page.getByRole('img', { name: 'ゴールの盤面' });
    await page.screenshot({ path: `${OUT}${kind}-goal-a-mid.png` });
    // tap to skip
    const box = await goal.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(60);
    await page.screenshot({ path: `${OUT}${kind}-goal-b-afterskip-60ms.png` });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}${kind}-goal-c-afterskip-660ms.png` });
    // tap settled board
    await page.mouse.click(box.x + 20, box.y + 20);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}${kind}-goal-d-tap-settled.png` });
    // replay
    const replay = page.getByRole('button', { name: '始まりの盤面から見せ直す' });
    console.log(kind, 'replay box', await replay.boundingBox(), 'goal box', box);
    await replay.click();
    const t0 = Date.now();
    for (const t of [30, 400, 900, 2500, 4200, 5200, 7000]) {
      const w = t - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w);
      await page.screenshot({ path: `${OUT}${kind}-goal-e-replay-${t}.png` });
    }
    const btnHere = await page.getByRole('button', { name: '始まりの盤面から見せ直す' }).count();
    console.log('replay button count after', btnHere);
    // layout positions
    const pos = await page.evaluate(() => {
      const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x*10)/10, Math.round(r.y*10)/10, Math.round(r.right*10)/10, Math.round(r.bottom*10)/10]; };
      const goal = document.querySelector('[aria-label="ゴールの盤面"]');
      const cells = [...goal.querySelectorAll('button')].map(b => b.getBoundingClientRect());
      const minX = Math.min(...cells.map(r => r.x)), maxX = Math.max(...cells.map(r => r.right));
      const allText = [...goal.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim()).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim(), Math.round(r.x), Math.round(r.right), Math.round(r.y), Math.round(r.bottom)]; });
      const tut = [...document.querySelectorAll('button')].find(b => b.textContent.includes('チュートリアル'));
      return { goal: q('[aria-label="ゴールの盤面"]'), cellsX: [minX, maxX], replay: q('[aria-label="始まりの盤面から見せ直す"]'), tut: tut && [tut.getBoundingClientRect().x, tut.getBoundingClientRect().y, tut.getBoundingClientRect().right, tut.getBoundingClientRect().bottom], vw: innerWidth, texts: allText.slice(-14) };
    });
    console.log(JSON.stringify(pos));
    console.log(errs.join('\n'));
    await browser.close();
  }
})();
