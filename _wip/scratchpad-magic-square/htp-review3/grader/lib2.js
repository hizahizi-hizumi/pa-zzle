const { OUT } = require('./lib');
// helpers for example panels in the active tab
async function panels(page) {
  return await page.$$('[role=tabpanel][data-state=active] [data-reset-button-placement]');
}
async function shotPanel(page, panel, name, extraTop = 0) {
  const b = await panel.boundingBox();
  const vh = page.viewportSize().height;
  const y = Math.max(0, b.y - extraTop);
  const h = Math.min(vh - y, b.height + extraTop + 4);
  await page.screenshot({ path: OUT + name + '.png', clip: { x: 0, y, width: page.viewportSize().width, height: h } });
}
async function hintCenter(panel) {
  return await panel.evaluate((p) => {
    const hs = [...p.querySelectorAll('[data-how-to-play-press-hint]')].filter((h) => {
      const cs = getComputedStyle(h);
      const r = h.getBoundingClientRect();
      return cs.visibility !== 'hidden' && cs.opacity !== '0' && r.width > 0;
    });
    return hs.map((h) => {
      const r = h.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    });
  });
}
async function verdictText(panel) {
  return await panel.evaluate((p) => {
    const vis = (e) => {
      let x = e;
      while (x && x !== p) {
        const cs = getComputedStyle(x);
        if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') return false;
        x = x.parentElement;
      }
      return true;
    };
    return [...p.querySelectorAll('figcaption')]
      .map((f) => [...f.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() && vis(e)).map((e) => e.textContent.trim()).join(' '))
      .join(' || ');
  });
}
async function resetVisible(panel) {
  return await panel.evaluate((p) => {
    const b = p.parentElement.querySelector('[aria-label="例を元に戻す"]') || p.querySelector('[aria-label="例を元に戻す"]');
    if (!b) return 'none';
    let x = b;
    while (x) {
      const cs = getComputedStyle(x);
      if (cs.visibility === 'hidden' || cs.display === 'none') return 'hidden';
      x = x.parentElement;
      if (x === document.body) break;
    }
    return 'visible';
  });
}
module.exports = { panels, shotPanel, hintCenter, verdictText, resetVisible };
