// チュートリアルの盤面を総当たりで探す（絞り込み版）。使い方: MAXSTART=1 MAXS5=3 node search2.mjs
const M = [14, 4, 5, 11, 9, 2, 7, 16, 8, 13, 12, 1, 3, 15, 10, 6];
const rows = [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => r * 4 + c));
const cols = [0, 1, 2, 3].map((c) => [0, 1, 2, 3].map((r) => r * 4 + c));
const diags = [[0, 5, 10, 15], [3, 6, 9, 12]];
const lines = { row: rows, column: cols, diagonal: diags };
const allLines = [...rows, ...cols, ...diags];
const kinds = ["row", "column", "diagonal"];
const linesOf = (cell, kind) => lines[kind].filter((l) => l.includes(cell));
const emptiesIn = (line, filled) => line.filter((c) => !filled.has(c));
const singleBy = (cell, kind, filled) => linesOf(cell, kind).some((l) => { const e = emptiesIn(l, filled); return e.length === 1 && e[0] === cell; });
const decidable = (cell, filled) => !filled.has(cell) && kinds.some((k) => singleBy(cell, k, filled));
const kindsOf = (cell, filled) => kinds.filter((k) => singleBy(cell, k, filled));
const pos = (c) => `${Math.floor(c / 4) + 1}行${(c % 4) + 1}列`;
const MAXSTART = Number(process.env.MAXSTART ?? 0);
const MAXS5 = Number(process.env.MAXS5 ?? 2);

function combos(arr, k, start = 0, acc = [], out = []) {
  if (acc.length === k) { out.push([...acc]); return out; }
  for (let i = start; i < arr.length; i += 1) { acc.push(arr[i]); combos(arr, k, i + 1, acc, out); acc.pop(); }
  return out;
}
const show = (empties) => [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (empties.includes(r * 4 + c) ? " ." : String(M[r * 4 + c]).padStart(2))).join(" ")).join(" / ");

let count = 0;
for (const empties of combos([...Array(16).keys()], Number(process.env.EMPTIES ?? 8))) {
  const givens = new Set([...Array(16).keys()].filter((c) => !empties.includes(c)));
  if (allLines.some((l) => l.every((c) => givens.has(c)))) continue;
  const startSingles = empties.filter((c) => decidable(c, givens));
  if (startSingles.length > MAXSTART) continue;
  const arrangements = [];
  for (const a of empties) {
    const f1 = new Set([...givens, a]);
    for (const b of empties) {
      if (b === a || singleBy(b, "row", givens)) continue;
      if (!singleBy(b, "row", f1) || singleBy(b, "column", f1) || singleBy(b, "diagonal", f1)) continue;
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
          if (s5.length === 0 || s5.length > MAXS5) continue;
          let filled = new Set(f4);
          let ok = true;
          while (filled.size < 16) {
            const next = empties.find((e) => decidable(e, filled));
            if (next === undefined) { ok = false; break; }
            filled = new Set([...filled, next]);
          }
          if (!ok) continue;
          arrangements.push(`a ${pos(a)} b ${pos(b)} c ${pos(c)} d ${pos(d)} | s5 ${s5.map((e) => `${pos(e)}:${kindsOf(e, f4).join("+")}`).join(" ")}`);
        }
      }
    }
  }
  if (arrangements.length === 0) continue;
  count += 1;
  console.log(show(empties), ` startSingles=${startSingles.map(pos).join(",") || "-"}`);
  for (const x of arrangements.filter((x) => /^a 1行/.test(x))) console.log("    ", x);
}
console.log("sets", count);
