const { openHelp } = require('./lib');
(async () => {
  const { browser, page, errors } = await openHelp('sp');
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const out = [];
    const goal = document.querySelector('[role=dialog]');
    // goal area buttons
    const panel = document.querySelector('[role=tabpanel][data-state=active]');
    const secs = panel.querySelectorAll(':scope > div > section');
    secs.forEach((s, i) => {
      const btns = s.querySelectorAll('button, [role=gridcell], [role=button]');
      out.push(`section ${i}: ${btns.length} controls`);
      btns.forEach(b => {
        const r = b.getBoundingClientRect();
        out.push(`  ${b.tagName} role=${b.getAttribute('role')} label=${b.getAttribute('aria-label')} text=${b.innerText.replace(/\n/g,' ').slice(0,20)} disabled=${b.disabled} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      });
    });
    // Goal area controls
    const top = document.querySelector('[role=dialog] .isolate');
    const gb = top.querySelectorAll('button, [role=gridcell], [role=button]');
    out.push('top controls ' + gb.length);
    gb.forEach(b => { const r = b.getBoundingClientRect(); out.push(`  ${b.tagName} role=${b.getAttribute('role')} label=${b.getAttribute('aria-label')} text=${b.innerText.replace(/\n/g,' ').slice(0,20)} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`); });
    return out.join('\n');
  });
  console.log(info);
  await browser.close();
})();
