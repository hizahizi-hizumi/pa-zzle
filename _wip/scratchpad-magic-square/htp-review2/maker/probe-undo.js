// 本番で、列の端の色を変えない数を置いてほかのマスを選ばずに「待った」で外したとき、置き直しが増えないことを確かめる。
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5342/puzzles/magic-square', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /ランダムに遊ぶ/ }).click();
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('[role=group][aria-label="魔方陣の盤面"] button')].map(b => b.getAttribute('aria-label'));
    const n = Math.round(Math.sqrt(cells.length));
    const vals = cells.map(l => { const m = l.match(/^\d+行\d+列 (\d+)$/); return m ? Number(m[1]) : null; });
    const sum = n * (n * n + 1) / 2;
    const lines = [];
    for (let r = 0; r < n; r++) lines.push([...Array(n)].map((_, c) => r * n + c));
    for (let c = 0; c < n; c++) lines.push([...Array(n)].map((_, r) => r * n + c));
    lines.push([...Array(n)].map((_, i) => i * n + i));
    lines.push([...Array(n)].map((_, i) => i * n + (n - 1 - i)));
    const avail = [...document.querySelectorAll('[role=group][aria-label="盤面の下に並んだ数"] button:not([disabled])')].map(b => Number(b.textContent));
    for (let idx = 0; idx < vals.length; idx++) {
      if (vals[idx] !== null) continue;
      const through = lines.filter(l => l.includes(idx));
      for (const v of avail) {
        const ok = through.every(l => { const empties = l.filter(i => vals[i] === null).length; const s = l.reduce((a, i) => a + (vals[i] ?? 0), 0); return empties >= 2 && s + v < sum; });
        if (ok) return { idx, v, n, label: cells[idx] };
      }
    }
    return null;
  });
  console.log('choice', info);
  const header = async () => (await page.locator('text=置き直し').first().locator('..').innerText()).replace(/\s+/g, ' ');
  const cell = page.getByRole('group', { name: '魔方陣の盤面' }).getByRole('button', { name: info.label, exact: true });
  await cell.click(); await page.waitForTimeout(150);
  await page.getByRole('group', { name: '盤面の下に並んだ数' }).getByRole('button', { name: String(info.v), exact: true }).click();
  await page.waitForTimeout(300);
  console.log('after place:', await header());
  await page.screenshot({ path: 'prod-undo-1-placed.png' });
  await page.getByRole('button', { name: '待った' }).click();
  await page.waitForTimeout(300);
  console.log('after 待った (same cell, no other selection):', await header());
  await page.screenshot({ path: 'prod-undo-2-after-undo.png' });
  // 対照: 置いてからほかのマスを選び、待ったで外す
  await page.getByRole('button', { name: '待った' }).isDisabled().then(d => console.log('undo disabled now:', d));
  await cell.click(); await page.waitForTimeout(100);
  await page.getByRole('group', { name: '盤面の下に並んだ数' }).getByRole('button', { name: String(info.v), exact: true }).click();
  await page.waitForTimeout(200);
  const other = page.getByRole('group', { name: '魔方陣の盤面' }).getByRole('button').first();
  await other.click(); await page.waitForTimeout(150);
  await page.getByRole('button', { name: '待った' }).click();
  await page.waitForTimeout(300);
  console.log('after 待った (after selecting another cell):', await header());
  await page.screenshot({ path: 'prod-undo-3-after-other-select-undo.png' });
  await browser.close();
})();
