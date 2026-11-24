// チュートリアルの盤面を総当たりで探す。使い方: node search.mjs
// 4×4 の魔方陣から8マスを空け、操作→横→縦→斜め→自分で探す→手を離す、の順に解けるものを数える。
const M = [14, 4, 5, 11, 9, 2, 7, 16, 8, 13, 12, 1, 3, 15, 10, 6];
const N = 4;
const rows = [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => r * N + c));
const cols = [0, 1, 2, 3].map((c) => [0, 1, 2, 3].map((r) => r * N + c));
const diags = [[0, 5, 10, 15], [3, 6, 9, 12]];
const lines = { row: rows, column: cols, diagonal: diags };
const linesOf = (cell, kind) => lines[kind].filter((l) => l.includes(cell));
const emptiesIn = (line, filled) => line.filter((c) => !filled.has(c));
const singleBy = (cell, kind, filled) => linesOf(cell, kind).some((l) => emptiesIn(l, filled).length === 1 && emptiesIn(l, filled)[0] === cell);
const kinds = ["row", "column", "diagonal"];
const decidable = (cell, filled) => !filled.has(cell) && kinds.some((k) => singleBy(cell, k, filled));

function combos(arr, k, start = 0, acc = [], out = []) {
  if (acc.length === k) { out.push([...acc]); return out; }
  for (let i = start; i < arr.length; i += 1) { acc.push(arr[i]); combos(arr, k, i + 1, acc, out); acc.pop(); }
  return out;
}

const results = [];
for (const empties of combos([...Array(16).keys()], 8)) {
  const givens = new Set([...Array(16).keys()].filter((c) => !empties.includes(c)));
  // 始めの盤面に、空きが1つの列が無い（どの手順も決め手の列を自分の手で作ってから使う）
  const startSingles = empties.filter((c) => decidable(c, givens));
  for (const a of empties) {
    const f1 = new Set([...givens, a]);
    for (const b of empties) {
      if (b === a) continue;
      if (!singleBy(b, "row", f1) || singleBy(b, "column", f1) || singleBy(b, "diagonal", f1)) continue;
      // 操作の手で横の列の空きが1つになる
      if (singleBy(b, "row", givens)) continue;
      const f2 = new Set([...f1, b]);
      for (const c of empties) {
        if (f2.has(c)) continue;
        if (!singleBy(c, "column", f2) || singleBy(c, "row", f2) || singleBy(c, "diagonal", f2)) continue;
        const f3 = new Set([...f2, c]);
        for (const d of empties) {
          if (f3.has(d)) continue;
          if (!singleBy(d, "diagonal", f3) || singleBy(d, "row", f3) || singleBy(d, "column", f3)) continue;
          const f4 = new Set([...f3, d]);
          const s5 = empties.filter((e) => decidable(e, f4));
          if (s5.length === 0) continue;
          // 手を離した後: 空きが1つの列だけで解き切れる
          let filled = new Set(f4);
          let ok = true;
          const order = [];
          while (filled.size < 16) {
            const next = empties.find((e) => decidable(e, filled));
            if (next === undefined) { ok = false; break; }
            order.push(next);
            filled = new Set([...filled, next]);
          }
          if (!ok) continue;
          results.push({ empties, a, b, c, d, s5, startSingles: startSingles.length, rest: 8 - 4 });
        }
      }
    }
  }
}
console.log("found", results.length);
const show = (r) => {
  const grid = M.map((v, i) => (r.empties.includes(i) ? " ." : String(v).padStart(2)));
  return [0, 1, 2, 3].map((row) => grid.slice(row * 4, row * 4 + 4).join(" ")).join(" / ");
};
const byS5 = results.filter((r) => r.startSingles <= 1 && r.s5.length === 1);
console.log("startSingles<=1 && one S5", byS5.length);
for (const r of byS5.slice(0, 40)) console.log(show(r), "a", r.a, "b", r.b, "c", r.c, "d", r.d, "s5", r.s5, "startSingles", r.startSingles);
const dist = {};
for (const r of results) { const k = `start${r.startSingles}-s5:${r.s5.length}`; dist[k] = (dist[k] ?? 0) + 1; }
console.log(Object.entries(dist).sort().map(([k, v]) => `${k}=${v}`).join(" "));
const pos = (c) => `${Math.floor(c / 4) + 1}行${(c % 4) + 1}列`;
const kindsOf = (cell, filled) => kinds.filter((k) => singleBy(cell, k, filled));
const picked = results.filter((r) => r.startSingles <= Number(process.env.MAXSTART ?? 0) && r.s5.length <= Number(process.env.MAXS5 ?? 2));
const seen = new Set();
for (const r of picked) {
  const key = r.empties.join(",");
  const f4 = new Set([...Array(16).keys()].filter((c) => !r.empties.includes(c) || [r.a, r.b, r.c, r.d].includes(c)));
  const rest = r.empties.filter((e) => !f4.has(e));
  const s5k = r.s5.map((e) => `${pos(e)}:${kindsOf(e, f4).join("+")}`).join(" ");
  console.log(show(r), "| a", pos(r.a), "b", pos(r.b), "c", pos(r.c), "d", pos(r.d), "| s5", s5k, "| rest", rest.map(pos).join(","));
  seen.add(key);
}
console.log("distinct empties", seen.size);
