import { mkdirSync, writeFileSync } from "node:fs";
import { loadFont, textPath } from "./glyphs.mjs";
const bold = loadFont("/usr/share/fonts/opentype/inter/Inter-Bold.otf");
const semi = loadFont("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf");
const CAP = 1490;
const STRONG = "var(--game-pictogram-strong)";
const SOFT = "var(--game-pictogram-soft)";
const LO_SHU = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];
const out = process.argv[2] ?? "round2";
mkdirSync(out, { recursive: true });
const p = (v) => +v.toFixed(2);
function grid(x, y, size, n = 3) {
  const step = size / n;
  let d = "";
  for (let i = 1; i < n; i += 1) d += `M${p(x + step * i)} ${y}v${size}M${x} ${p(y + step * i)}h${size}`;
  return `  <path fill="none" stroke="${SOFT}" stroke-width="2" d="${d}"/>\n  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="none" stroke="${STRONG}" stroke-width="4"/>\n`;
}
function digits(font, cells, x, y, size, cap, color = STRONG) {
  const step = size / 3;
  let d = "";
  cells.forEach((row, r) => row.forEach((v, c) => {
    if (v !== null) d += textPath(font, String(v), x + step * (c + 0.5), y + step * (r + 0.5), cap, CAP);
  }));
  return `  <path fill="${color}" d="${d}"/>\n`;
}
function labels(font, items, cap, color = STRONG) {
  return `  <path fill="${color}" d="${items.map(([t, cx, cy]) => textPath(font, t, cx, cy, cap, CAP)).join("")}"/>\n`;
}
function svg(name, body) {
  writeFileSync(`${out}/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="魔方陣">\n${body}</svg>\n`);
}
// A
svg("A1-loshu-bold15", grid(18, 18, 84) + digits(bold, LO_SHU, 18, 18, 84, 15));
svg("A2-loshu-semi13", grid(18, 18, 84) + digits(semi, LO_SHU, 18, 18, 84, 13));
// D: 行の端にそろった合計（帯を中央に寄せる）
for (const [name, color, font] of [["D1-rowsums-soft", SOFT, bold], ["D2-rowsums-strong", STRONG, semi]]) {
  const x = 12, y = 20, size = 78, step = 26;
  svg(name, grid(x, y, size) + digits(semi, LO_SHU, x, y, size, 13) +
    labels(font, [0, 1, 2].map((r) => ["15", x + size + 13, y + step * (r + 0.5)]), 11, color));
}
// D3: 行の端と列の下の両方に合計
{
  const x = 12, y = 12, size = 78, step = 26;
  svg("D3-row-col-sums", grid(x, y, size) + digits(semi, LO_SHU, x, y, size, 13) +
    labels(bold, [
      ...[0, 1, 2].map((r) => ["15", x + size + 13, y + step * (r + 0.5)]),
      ...[0, 1, 2].map((c) => ["15", x + step * (c + 0.5), y + size + 13]),
    ], 10, SOFT));
}
// B: 行・縦の列・斜めの3方向の端に合計（プレイ画面の置き方）
{
  const x = 14, y = 14, size = 72, step = 24;
  svg("B1-three-ends", grid(x, y, size) + digits(semi, LO_SHU, x, y, size, 12) +
    labels(bold, [["15", x + size + 13, y + step * 1.5], ["15", x + step * 1.5, y + size + 13], ["15", x + size + 15, y + size + 15]], 11) +
    `  <path fill="none" stroke="${STRONG}" stroke-width="2" stroke-linecap="round" d="M${x + size + 3} ${y + size + 3}l4 4"/>\n`);
}
// C: 途中の盤（十字の数）と、行・縦の列の合計
{
  const x = 14, y = 14, size = 72, step = 24;
  const cross = [[null, 9, null], [3, 5, 7], [null, 1, null]];
  svg("C1-cross", grid(x, y, size) + digits(semi, cross, x, y, size, 13) +
    labels(bold, [["15", x + size + 14, y + step * 1.5], ["15", x + step * 1.5, y + size + 14]], 12));
  const diag = [[4, null, null], [null, 5, null], [null, null, 6]];
  svg("C2-row-col-diag-partial", grid(x, y, size) + digits(semi, [[4, 9, 2], [null, 5, null], [null, null, 6]], x, y, size, 13) +
    labels(bold, [["15", x + size + 14, y + step * 0.5], ["15", x + size + 15, y + size + 15]], 12) +
    `  <path fill="none" stroke="${STRONG}" stroke-width="2" stroke-linecap="round" d="M${x + size + 3} ${y + size + 3}l4 4"/>\n`);
}
