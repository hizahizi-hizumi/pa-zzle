import { mkdirSync, writeFileSync } from "node:fs";
import { loadFont, textPath } from "./glyphs.mjs";
const font = loadFont("/usr/share/fonts/opentype/inter/Inter-Bold.otf");
const CAP = 1490;
const STRONG = "var(--game-pictogram-strong)";
const SOFT = "var(--game-pictogram-soft)";
const LO_SHU = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];
const out = process.argv[2] ?? "candidates";
mkdirSync(out, { recursive: true });

function grid(x, y, size, n = 3, rx = 2) {
  const step = size / n;
  let d = "";
  for (let i = 1; i < n; i += 1) {
    const p = (v) => +(v).toFixed(2);
    d += `M${p(x + step * i)} ${y}v${size}M${x} ${p(y + step * i)}h${size}`;
  }
  return `  <path fill="none" stroke="${SOFT}" stroke-width="2" d="${d}"/>\n  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${rx}" fill="none" stroke="${STRONG}" stroke-width="4"/>\n`;
}
function digits(cells, x, y, size, cap, color = STRONG, n = 3) {
  const step = size / n;
  let d = "";
  cells.forEach((row, r) => row.forEach((v, c) => {
    if (v === null) return;
    d += textPath(font, String(v), x + step * (c + 0.5), y + step * (r + 0.5), cap, CAP);
  }));
  return `  <path fill="${color}" d="${d}"/>\n`;
}
function label(text, cx, cy, cap, color = STRONG) {
  return `  <path fill="${color}" d="${textPath(font, text, cx, cy, cap, CAP)}"/>\n`;
}
function svg(name, body) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="魔方陣">\n${body}</svg>\n`;
  writeFileSync(`${out}/${name}.svg`, s);
}

// A 洛書: 数で埋まった3×3
svg("A-loshu", grid(18, 18, 84) + digits(LO_SHU, 18, 18, 84, 15));

// B 洛書と端の合計（プレイ画面と同じ置き方）
{
  const x = 12, y = 12, size = 72, step = 24;
  svg("B-loshu-sums", grid(x, y, size) + digits(LO_SHU, x, y, size, 12) +
    label("15", x + size + 14, y + step * 1.5, 11) +
    label("15", x + step * 1.5, y + size + 14, 11) +
    `  <path fill="none" stroke="${STRONG}" stroke-width="2" stroke-linecap="round" d="M${x + size + 4} ${y + size + 4}l5 5"/>\n` +
    label("15", x + size + 16, y + size + 16, 11));
}

// C 十字の数と2つの合計
{
  const x = 14, y = 14, size = 72, step = 24;
  const cross = [[null, 9, null], [3, 5, 7], [null, 1, null]];
  svg("C-cross-sums", grid(x, y, size) + digits(cross, x, y, size, 12) +
    label("15", x + size + 14, y + step * 1.5, 12) +
    label("15", x + step * 1.5, y + size + 14, 12));
}

// D 洛書と、行の端にそろった合計
{
  const x = 10, y = 18, size = 78, step = 26;
  svg("D-loshu-row-sums", grid(x, y, size) + digits(LO_SHU, x, y, size, 13) +
    [0, 1, 2].map((r) => label("15", x + size + 13, y + step * (r + 0.5), 11, SOFT)).join(""));
}
