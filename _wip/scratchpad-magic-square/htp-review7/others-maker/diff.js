// 変更前と変更後の違いと、気になる所だけを並べる: node diff.js <game> [dev...]
const fs = require('fs');
const path = require('path');
const [game, ...devs] = process.argv.slice(2);
const DEVS = devs.length ? devs : ['phone', 'w320', 'pc'];
const load = (v, d) => {
  const f = path.join(__dirname, 'shots', game, `${v}-${d}-result.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const g = (t) => t.geo;
for (const d of DEVS) {
  const A = load('after', d);
  const B = load('before', d);
  console.log(`\n## ${game} ${d}`);
  if (!A || !B) { console.log('  missing', !!A, !!B); continue; }
  for (const [n, R] of [['before', B], ['after', A]]) {
    if (R.fatal) console.log(`  ${n} FATAL ${R.fatal.split('\n')[0]}`);
    if (R.errors && R.errors.length) console.log(`  ${n} errors: ${R.errors.slice(0, 3).join(' | ')}`);
  }
  const gb = JSON.stringify(B.goal && B.goal.btn), ga = JSON.stringify(A.goal && A.goal.btn);
  console.log(`  goal btn ${gb === ga ? 'same' : `DIFF ${gb} -> ${ga}`} board=${JSON.stringify(A.goal && A.goal.boardBox)}`);
  for (const tab of ['rules', 'operations', 'scoring']) {
    const mb = B.tabs[tab] && B.tabs[tab].metrics, ma = A.tabs[tab] && A.tabs[tab].metrics;
    if (!mb || !ma) { console.log(`  [${tab}] missing`); continue; }
    const hs = (m) => [...new Set(m.headings.map((h) => `${h.tag}:${h.fs}`))].join(' ');
    console.log(`  [${tab}] headings ${hs(mb)} -> ${hs(ma)}; overflow ${mb.overflow.length} -> ${ma.overflow.length}`);
    for (const o of ma.overflow) console.log(`     after OVERFLOW ${o.tag} ${o.cls} x=${o.rect.x} r=${o.rect.r}`);
    ma.panels.forEach((p, i) => {
      const q = mb.panels[i] || {};
      const s = `${q.placement} ${q.pt}/${q.pb} h=${q.rect && q.rect.h}`;
      const t = `${p.placement} ${p.pt}/${p.pb} h=${p.rect.h}`;
      console.log(`     panel${i} figs=${p.figs.length} ${s} -> ${t} "${(p.heading || '').slice(0, 20)}"`);
    });
    ma.flows.forEach((f, i) => {
      const q = mb.flows[i] || {};
      console.log(`     flow${i} h ${q.rect && q.rect.h}->${f.rect.h} caps ${q.caps && q.caps.map((c) => c.lines).join(',')} -> ${f.caps.map((c) => c.lines).join(',')} inert=${f.inert}`);
    });
    const key = (t) => `${t.where}:${t.text}`;
    const mapB = new Map(mb.textBlocks.map((t) => [key(t), t]));
    for (const t of ma.textBlocks) {
      if (!['li', 'menu'].includes(t.where)) continue;
      const q = mapB.get(key(t));
      if (!q || q.lines !== t.lines || q.last !== t.last || q.fs !== t.fs) console.log(`     text[${t.where}] ${q ? `${q.fs} ${q.lines}L "${q.last}"` : 'NEW'} -> ${t.fs} ${t.lines}L "${t.last}" :: ${t.text.slice(0, 44)}`);
    }
    if (tab === 'scoring') continue;
    for (const [n, R] of [['before', B], ['after', A]]) {
      for (const p of (R.tabs[tab].touches || [])) {
        const bad = [];
        for (const t of p.touches) {
          if (!t.touched) { bad.push(`f${t.fig}:not-touched`); continue; }
          const x = g(t);
          const flags = [];
          if (!x.nearTouched) flags.push(`nearest=f${x.nearest}`);
          if (!x.inViewport) flags.push(x.underSticky ? 'UNDER-STICKY' : 'OUT-OF-VIEW');
          if (!x.inPanel) flags.push('OUT-OF-PANEL');
          if (x.hits.length) flags.push(`HITS ${JSON.stringify(x.hits.slice(0, 2))}`);
          if (x.boardHits.length) flags.push(`BOARDHIT ${x.boardHits}`);
          if (t.afterResetShown) flags.push('RESET-STILL-SHOWN');
          bad.push(`f${t.fig}:${x.placement}/${x.side || '-'}(${x.btn.x},${x.btn.y})${flags.length ? ' ' + flags.join(' ') : ' ok'}`);
        }
        let extra = '';
        if (p.seq) extra += ` | seq→${p.seq.geo.side || p.seq.geo.placement}/near f${p.seq.geo.nearest}`;
        if (p.scroll) extra += ` | scroll(${p.scroll.scrolled}px from ${p.scroll.start.on && p.scroll.start.on.slice(0, 12)}): ${p.scroll.before.side}/${p.scroll.before.rel} -> ${p.scroll.after.side}/${p.scroll.after.rel} near f${p.scroll.before.nearest}->f${p.scroll.after.nearest}`;
        console.log(`   ${n} ${tab} p${p.panel} h=${p.panelHeight} ${bad.join('  ')}${extra}`);
      }
    }
  }
}
