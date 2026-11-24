// 結果の JSON を読みやすく並べる: node summarize.js <game> [dev...]
const fs = require('fs');
const path = require('path');
const [game, ...devs] = process.argv.slice(2);
const DEVS = devs.length ? devs : ['phone', 'w320', 'pc'];
const load = (v, d) => {
  const f = path.join(__dirname, 'shots', game, `${v}-${d}-result.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
for (const d of DEVS) {
  const A = load('after', d);
  const B = load('before', d);
  console.log(`\n######## ${game} ${d}  after=${!!A} before=${!!B}`);
  for (const [n, R] of [['before', B], ['after', A]]) {
    if (!R) continue;
    if (R.fatal) console.log(`  ${n} FATAL ${R.fatal.split('\n')[0]}`);
    if (R.errors && R.errors.length) console.log(`  ${n} errors: ${R.errors.slice(0, 3).join(' | ')}`);
    console.log(`  ${n} goal btn=${JSON.stringify(R.goal && R.goal.btn)} board=${JSON.stringify(R.goal && R.goal.boardBox)} tut=${JSON.stringify(R.goal && R.goal.tutorial)}`);
  }
  for (const tab of ['rules', 'operations', 'scoring']) {
    for (const [n, R] of [['before', B], ['after', A]]) {
      if (!R || !R.tabs[tab]) continue;
      const m = R.tabs[tab].metrics;
      console.log(`  [${tab}] ${n}: headings ${[...new Set(m.headings.map((h) => `${h.tag}:${h.fs}/${h.fw}`))].join(' ')} overflow=${m.overflow.length}`);
      for (const o of m.overflow.slice(0, 4)) console.log(`     OVERFLOW ${o.tag} ${o.cls} ${JSON.stringify(o.rect)}`);
      for (const p of m.panels) console.log(`     panel ${p.placement} h=${p.rect.h} pt=${p.pt} pb=${p.pb} figs=${p.figs.length} "${(p.heading || '').slice(0, 24)}"`);
      for (const f of m.flows) console.log(`     flow h=${f.rect.h} w=${f.rect.w} bg=${f.bg} border=${f.border} inert=${f.inert} childL=${f.childMinL - f.rect.x} childR=${f.rect.r - f.childMaxR} caps=${f.caps.map((c) => c.lines).join(',')}`);
      for (const t of m.textBlocks) if (t.where === 'li' || t.where === 'menu' || t.overflowPx > 0) console.log(`     text[${t.where} ${t.fs}] lines=${t.lines} over=${t.overflowPx} last="${t.last}" :: ${t.text.slice(0, 40)}`);
    }
    if (tab === 'scoring') continue;
    for (const [n, R] of [['before', B], ['after', A]]) {
      if (!R || !R.tabs[tab] || !R.tabs[tab].touches) continue;
      for (const p of R.tabs[tab].touches) {
        const parts = p.touches.map((t) => {
          if (!t.touched) return `f${t.fig}:NOT-TOUCHED`;
          const g = t.geo;
          return `f${t.fig}:${t.how}→${g.placement}/${g.side || '-'} btn=${g.btn.x},${g.btn.y} near=${g.nearest}${g.nearTouched ? '' : '(!)'} row=${g.besideTouchedRow} view=${g.inViewport}${g.underSticky ? '(UNDER-STICKY)' : ''} inPanel=${g.inPanel} hits=${g.hits.length}${g.hits.length ? JSON.stringify(g.hits.slice(0, 2)) : ''} boardHits=${g.boardHits} resetHidden=${!t.afterResetShown}`;
        });
        console.log(`   ${n} ${tab} p${p.panel} h=${p.panelHeight} "${(p.heading || '').slice(0, 22)}"`);
        for (const x of parts) console.log(`        ${x}`);
        if (p.seq) console.log(`        seq: b=${p.seq.b} side=${p.seq.geo.side} near=${p.seq.geo.nearest} view=${p.seq.geo.inViewport}`);
        if (p.scroll) console.log(`        scroll from f1 (${p.scroll.start.on}) scrolled=${p.scroll.scrolled}: ${p.scroll.before.side}/${p.scroll.before.rel} → ${p.scroll.after.side}/${p.scroll.after.rel} near ${p.scroll.before.nearest}→${p.scroll.after.nearest} MOVED=${p.scroll.moved}`);
      }
    }
  }
}
