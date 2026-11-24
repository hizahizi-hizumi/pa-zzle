import { mkdirSync, writeFileSync } from "node:fs";
import { loadFont, textPath } from "./glyphs.mjs";
const bold = loadFont("/usr/share/fonts/opentype/inter/Inter-Bold.otf");
const semi = loadFont("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf");
const CAP = 1490;
const STRONG = "var(--game-pictogram-strong)";
const SOFT = "var(--game-pictogram-soft)";
const LO_SHU = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];
const out = process.argv[2] ?? "final";
mkdirSync(out, { recursive: true });
const p = (v) => +v.toFixed(2);
function grid(x, y, size) {
  const step = size / 3;
  let d = "";
  for (let i = 1; i < 3; i += 1) d += `M${p(x + step * i)} ${y}v${size}M${x} ${p(y + step * i)}h${size}`;
  return `  <path fill="none" stroke="${SOFT}" stroke-width="2" d="${d}"/>\n  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="none" stroke="${STRONG}" stroke-width="4"/>\n`;
}
function digits(font, cells, x, y, size, cap) {
  const step = size / 3;
  let d = "";
  cells.forEach((row, r) => row.forEach((v, c) => {
    if (v !== null) d += textPath(font, String(v), x + step * (c + 0.5), y + step * (r + 0.5), cap, CAP);
  }));
  return `  <path fill="${STRONG}" d="${d}"/>\n`;
}
function labels(font, items, cap) {
  return `  <path fill="${STRONG}" d="${items.map(([t, cx, cy]) => textPath(font, t, cx, cy, cap, CAP)).join("")}"/>\n`;
}
function svg(name, body) {
  writeFileSync(`${out}/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="魔方陣">\n${body}</svg>\n`);
}
// A 洛書: 3×3 を数で埋める
svg("A-loshu", grid(18, 18, 84) + digits(semi, LO_SHU, 18, 18, 84, 13));
// B 行・縦の列・斜めの端に同じ合計（プレイ画面の置き方）
{
  const x = 14, y = 14, size = 72, step = 24;
  svg("B-three-ends", grid(x, y, size) + digits(semi, LO_SHU, x, y, size, 12) +
    labels(bold, [["15", x + size + 13, y + step * 1.5], ["15", x + step * 1.5, y + size + 13], ["15", x + size + 15, y + size + 15]], 12) +
    `  <path fill="none" stroke="${STRONG}" stroke-width="2" stroke-linecap="round" d="M${x + size + 3} ${y + size + 3}l5 5"/>\n`);
}
// C 解いている途中の盤（十字の数）と、行・縦の列の同じ合計
{
  const x = 14, y = 14, size = 72, step = 24;
  svg("C-cross", grid(x, y, size) + digits(semi, [[null, 9, null], [3, 5, 7], [null, 1, null]], x, y, size, 13) +
    labels(bold, [["15", x + size + 14, y + step * 1.5], ["15", x + step * 1.5, y + size + 14]], 12));
}
// D 数で埋めた3×3と、どの行の端にもそろった合計
{
  const x = 12, y = 20, size = 78, step = 26;
  svg("D-row-sums", grid(x, y, size) + digits(semi, LO_SHU, x, y, size, 13) +
    labels(semi, [0, 1, 2].map((r) => ["15", x + size + 14, y + step * (r + 0.5)]), 11.5));
}
