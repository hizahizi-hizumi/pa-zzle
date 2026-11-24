const { openHelp } = require('./lib');
(async () => {
  for (const kind of ['sp', 'pc']) {
    const { browser, page } = await openHelp(kind, { wait: 1200 });
    for (const tab of ['ルール', '操作', '採点']) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const panel = document.querySelector('[role=tabpanel][data-state=active]');
        const out = [];
        const R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.right), Math.round(r.bottom)]; };
        // example panels: padding between panel box and visible content (union of descendant rects that are visible & have size)
        panel.querySelectorAll('[data-reset-button-placement], .bg-muted').forEach((p) => {
          const pr = p.getBoundingClientRect();
          let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
          p.querySelectorAll('*').forEach((e) => {
            if (e.closest('[aria-label="例を元に戻す"]')) return;
            const cs = getComputedStyle(e);
            let x = e, hidden = false;
            while (x && x !== p) { const c = getComputedStyle(x); if (c.visibility === 'hidden' || c.opacity === '0') { hidden = true; break; } x = x.parentElement; }
            if (hidden) return;
            const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
            const visualBox = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px' || hasText || e.tagName === 'svg';
            if (!visualBox) return;
            const r = e.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.bottom); minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.right);
          });
          out.push(`panel ${R(p)} content top-pad=${Math.round(minY - pr.y)} bottom-pad=${Math.round(pr.bottom - maxY)} left-pad=${Math.round(minX - pr.x)} right-pad=${Math.round(pr.right - maxX)}`);
        });
        // menu card
        panel.querySelectorAll('ul, ol').forEach((u) => {
          const cs = getComputedStyle(u);
          if (cs.boxShadow !== 'none' || cs.borderTopWidth !== '0px') {
            const ur = u.getBoundingClientRect();
            let maxX = -1e9, minX = 1e9;
            u.querySelectorAll('span,p,svg').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width) { maxX = Math.max(maxX, r.right); minX = Math.min(minX, r.x); } });
            out.push(`card ${R(u)} shadow=${cs.boxShadow.slice(0, 40)} border=${cs.borderTopWidth} left-pad=${Math.round(minX - ur.x)} right-pad=${Math.round(ur.right - maxX)}`);
          }
        });
        // headings line starts
        panel.querySelectorAll('h3,h4,p').forEach((h) => {
          const t = h.textContent.trim();
          if (t.startsWith('「')) {
            const range = document.createRange();
            const tn = (function f(n) { for (const c of n.childNodes) { if (c.nodeType === 3 && c.textContent.trim()) return c; const r = f(c); if (r) return r; } return null; })(h);
            range.setStart(tn, 0); range.setEnd(tn, 1);
            const rr = range.getBoundingClientRect();
            out.push(`bracket-start "${t.slice(0, 12)}" elemX=${Math.round(h.getBoundingClientRect().x)} glyphBoxX=${rr.x.toFixed(1)} w=${rr.width.toFixed(1)} font=${getComputedStyle(h).fontSize}`);
          }
        });
        return out;
      });
      console.log(`## ${kind} ${tab}\n` + r.join('\n'));
    }
    await browser.close();
  }
})();
