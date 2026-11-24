// 書体の数字の輪郭を SVG の path にする。使い方: import { textPath } from "./glyphs.mjs"
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/frontend/package.json");
const hbPath = require.resolve("harfbuzzjs");
const hb = await import(hbPath);
export function loadFont(file) {
  const data = readFileSync(file);
  const blob = new hb.Blob(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  const face = new hb.Face(blob);
  const font = new hb.Font(face);
  return { font, face, upem: face.upem };
}
/** 文字列を、中心 (cx, cy)・数字の高さ capHeight で置いた path の d を返す。 */
export function textPath(loaded, text, cx, cy, capHeight, capUnits) {
  return glyphPaths(loaded, text, cx, cy, capHeight, capUnits).join("");
}
/** textPath と同じ置き方で、字ごとの path の d を配列で返す。 */
export function glyphPaths({ font }, text, cx, cy, capHeight, capUnits) {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer, [new hb.Feature("tnum", 1)]);
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  const glyphs = infos.map((info, i) => ({ g: info.codepoint, ax: positions[i].xAdvance }));
  const scale = capHeight / capUnits;
  const width = glyphs.reduce((sum, g) => sum + g.ax, 0) * scale;
  let x = cx - width / 2;
  const parts = [];
  for (const g of glyphs) {
    const d = font.glyphToJson(g.g);
    const tx = (v) => (x + v * scale).toFixed(2);
    const ty = (v) => (cy + capHeight / 2 - v * scale).toFixed(2);
    let out = "";
    for (const c of d) {
      const v = c.values;
      if (c.type === "M" || c.type === "L") out += `${c.type}${tx(v[0])} ${ty(v[1])}`;
      else if (c.type === "Q") out += `Q${tx(v[0])} ${ty(v[1])} ${tx(v[2])} ${ty(v[3])}`;
      else if (c.type === "C") out += `C${tx(v[0])} ${ty(v[1])} ${tx(v[2])} ${ty(v[3])} ${tx(v[4])} ${ty(v[5])}`;
      else if (c.type === "Z") out += "Z";
    }
    parts.push(out);
    x += g.ax * scale;
  }
  return parts;
}
