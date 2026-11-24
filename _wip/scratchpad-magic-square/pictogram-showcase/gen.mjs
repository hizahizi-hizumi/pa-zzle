// 魔方陣の選んでいるときの姿の候補を書き出す。使い方: node gen.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { glyphPaths, loadFont } from "../pictogram/glyphs.mjs";

const HERE = new URL(".", import.meta.url).pathname;
const BASE = "/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work/frontend/src/games/magic-square/assets/pictogram.svg";
const semi = loadFont("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf");
const CAP = 1490;
const P = "pz-magic-square-";

// 白黒版 D と同じ置き方
const X0 = 12, Y0 = 20, SIZE = 78, STEP = 26;
const DIGIT_CAP = 13, SUM_CAP = 11.5, SUM_X = 104;
const LO_SHU = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];
const cellCenter = (r, c) => [X0 + STEP * (c + 0.5), Y0 + STEP * (r + 0.5)];
const rowCenterY = (r) => Y0 + STEP * (r + 0.5);
const digitGlyphs = (r, c, v = LO_SHU[r][c]) => glyphPaths(semi, String(v), ...cellCenter(r, c), DIGIT_CAP, CAP);
const sumGlyphs = (r, text) => glyphPaths(semi, text, SUM_X, rowCenterY(r), SUM_CAP, CAP);

// 白黒版の字形と同じ図形かを確かめる
{
  const base = readFileSync(BASE, "utf8");
  const ds = [...base.matchAll(/<path fill="var\(--game-pictogram-strong\)" d="([^"]+)"/g)].map((m) => m[1]);
  const digits = LO_SHU.flatMap((row, r) => row.flatMap((_, c) => digitGlyphs(r, c))).join("");
  const sums = [0, 1, 2].flatMap((r) => sumGlyphs(r, "15")).join("");
  if (ds[0] !== digits || ds[1] !== sums) throw new Error("glyphs differ from the monochrome pictogram");
}

const tone = {
  slab: "#c9c2b5", recess: "#b2a999", tablet: "#f4f0e8",
  givenInk: "#2b2722", placedInk: "#2c4d73", sumInk: "#5a544b", matched: "#2f7a4b",
  selection: "#c26a12", selectedLine: "rgba(194,106,18,0.16)", clearGlint: "rgba(236,186,92,0.6)",
  shadow: "rgba(43,39,34,0.3)",
  /** プレイ画面の札の影（`MagicSquareBoard` の置いた数の札の box-shadow）と同じ色。 */
  tabletShadow: "rgba(43,39,34,0.38)",
};
// 地が暗いときに、盤の外の合計を見えるようにする色
const darkTone = { sumInk: "#a39b8c", matched: "#4f9e6b" };

const r2 = (v) => +v.toFixed(3);
/** マスを、囲む線の中心まで覆う矩形。 */
const cellRect = (r, c) => ({ x: X0 + STEP * c, y: Y0 + STEP * r, w: STEP, h: STEP });
/** マスのうち、線に覆われずに見える内側。 */
function cellInterior(r, c) {
  const x1 = X0 + STEP * c + (c === 0 ? 2 : 1);
  const x2 = X0 + STEP * (c + 1) - (c === 2 ? 2 : 1);
  const y1 = Y0 + STEP * r + (r === 0 ? 2 : 1);
  const y2 = Y0 + STEP * (r + 1) - (r === 2 ? 2 : 1);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}
const rect = ({ x, y, w, h }, attrs) => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}"${attrs}/>`;

/**
 * keyframes を時刻（ms）で書く。stops は [時刻, 宣言, 次の区間のイージング]。0 と period を含める。
 */
function keyframes(name, period, stops) {
  const body = stops.map(([t, decl, ease]) => {
    const pct = r2((t / period) * 100);
    return `${pct}%{${decl}${ease ? `;animation-timing-function:${ease}` : ""}}`;
  }).join("");
  return `@keyframes ${P}${name}{${body}}`;
}
const STANDARD = "cubic-bezier(0.4, 0, 0.2, 1)";
const CELEBRATE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const DROP = "cubic-bezier(0.55, 0, 0.9, 0.5)";

function build({ name, period, givenCells, startEmpty, story }) {
  const css = [];
  const anim = [];
  const add = (cls, stops) => {
    css.push(keyframes(cls, period, stops));
    anim.push(`[data-pictogram-motion="play"] .${P}${cls}{animation:${P}${cls} ${period}ms linear infinite}`);
  };
  const origin = [];
  const setOrigin = (cls, x, y) => origin.push(`.${P}${cls}{transform-box:view-box;transform-origin:${r2(x)}px ${r2(y)}px}`);
  const hidden = [];
  const hide = (cls) => hidden.push(`.${P}${cls}`);

  const placedCells = [];
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) if (!givenCells.has(`${r}${c}`)) placedCells.push([r, c]);

  const layers = { faces: [], under: [], digits: [], over: [], sums: [], lifted: [] };
  layers.faces.push(`<rect x="${X0}" y="${Y0}" width="${SIZE}" height="${SIZE}" rx="2" fill="${tone.slab}"/>`);
  for (const [r, c] of placedCells) {
    const id = `${r}${c}`;
    const cls = startEmpty.has(id) ? ` class="${P}placed-${id}"` : "";
    layers.faces.push(rect(cellRect(r, c), ` fill="${tone.recess}"`));
    layers.faces.push(rect(cellRect(r, c), ` fill="${tone.tablet}"${cls}`));
  }
  const lines = [
    `<path fill="none" stroke="var(--game-pictogram-soft)" stroke-width="2" d="M38 20v78M12 46h78M64 20v78M12 72h78"/>`,
    `<rect x="12" y="20" width="78" height="78" rx="2" fill="none" stroke="var(--game-pictogram-strong)" stroke-width="4" class="${P}frame"/>`,
  ];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const id = `${r}${c}`;
      const given = givenCells.has(id);
      const cls = startEmpty.has(id) ? ` class="${P}placed-${id}"` : "";
      const fill = given ? tone.givenInk : tone.placedInk;
      const paths = digitGlyphs(r, c).map((d) => `<path d="${d}"/>`).join("");
      layers.digits.push(`<g fill="${fill}"${cls}>${paths}</g>`);
    }
  }
  const sumPaths = (r, text) => sumGlyphs(r, text).map((d) => `<path d="${d}"/>`).join("");

  const ctx = {
    period, add, setOrigin, hide, layers, tone,
    cellInterior, cellRect, rect, sumPaths, digitGlyphs, rowCenterY,
    /** 持ち上げた札を落として、マスに収める。`lift` は持ち上げた札の大きさの倍率。 */
    lifted(r, c, appear, land, { lift = 1.3, shadowColor = tone.shadow } = {}) {
      const id = `${r}${c}`;
      const inner = cellInterior(r, c);
      const face = rect(inner, ` fill="${tone.tablet}"`);
      const shadow = rect(inner, ` fill="${shadowColor}" class="${P}shadow-${id}"`);
      const paths = digitGlyphs(r, c).map((d) => `<path d="${d}"/>`).join("");
      layers.lifted.push(`<g class="${P}lift-${id}"><g class="${P}drop-${id}">${shadow}${face}<g fill="${tone.placedInk}">${paths}</g></g></g>`);
      hide(`lift-${id}`);
      setOrigin(`drop-${id}`, inner.cx, inner.cy);
      add(`lift-${id}`, [[0, "opacity:0"], [appear, "opacity:0", "ease-out"], [appear + 60, "opacity:1", "step-end"], [land, "opacity:0"], [period, "opacity:0"]]);
      add(`drop-${id}`, [[0, `transform:scale(${lift})`], [appear + 100, `transform:scale(${lift})`, DROP], [land, "transform:none"], [period, "transform:none"]]);
      add(`shadow-${id}`, [[0, "transform:translate(0px, 3px)"], [appear + 100, "transform:translate(0px, 3px)", DROP], [land, "transform:none"], [period, "transform:none"]]);
      add(`placed-${id}`, [[0, "opacity:0"], [land - 10, "opacity:0", "step-end"], [land, "opacity:1"], [period, "opacity:1"]]);
    },
    /** 合計の数を、時刻ごとに差し替える。 */
    sum(r, steps) {
      // steps: [[文字列, 出る時刻, 消える時刻 | null]]
      steps.forEach(([text, from, to], i) => {
        const matched = text === "15";
        const cls = `sum-${r}-${i}`;
        const color = matched ? "matched" : "partial";
        layers.sums.push(`<g class="${P}${color} ${P}${cls}"><g class="${P}pop-${r}">${sumPaths(r, text)}</g></g>`);
        if (to === null && from === 0) return;
        if (to !== null) hide(cls);
        const stops = [[0, `opacity:${from === 0 ? 1 : 0}`]];
        if (from > 0) stops.push([from - 10, "opacity:0", "step-end"], [from, "opacity:1"]);
        if (to !== null) stops.push([to - 10, "opacity:1", "step-end"], [to, "opacity:0"]);
        stops.push([period, `opacity:${to === null ? 1 : 0}`]);
        add(cls, stops);
      });
    },
    pop(r, at, scale = 1.25) {
      setOrigin(`pop-${r}`, SUM_X, rowCenterY(r));
      add(`pop-${r}`, [[0, "transform:none"], [at, "transform:none", CELEBRATE], [at + 160, `transform:scale(${scale})`, "ease-in-out"], [at + 400, "transform:none"], [period, "transform:none"]]);
    },
    glint(cls, shapes, at, { peak = 1, rise = 126, length = 360 } = {}) {
      for (const shape of [shapes].flat()) layers.under.push(rect(shape, ` fill="${tone.clearGlint}" class="${P}${cls}"`));
      hide(cls);
      add(cls, [[0, "opacity:0"], [at, "opacity:0", STANDARD], [at + rise, `opacity:${peak}`, STANDARD], [at + length, "opacity:0"], [period, "opacity:0"]]);
    },
  };
  story(ctx);

  const colorRules = [
    `.${P}matched{fill:${tone.matched}}`, `.${P}partial{fill:${tone.sumInk}}`,
    `.dark .${P}matched{fill:${darkTone.matched}}`, `.dark .${P}partial{fill:${darkTone.sumInk}}`,
  ];
  const style = [...colorRules, `${hidden.join(",")}{opacity:0}`, ...origin,
    `@media (prefers-reduced-motion: no-preference){${anim.join("")}${css.join("")}}`].join("");
  const body = [...layers.faces, ...layers.under, ...lines, ...layers.digits, ...layers.over, ...layers.sums, ...layers.lifted];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="魔方陣">\n<style>${style}</style>\n${body.join("\n")}\n</svg>\n`;
  writeFileSync(`${HERE}${name}.svg`, svg);
}

const CORNERS_AND_CENTER = new Set(["00", "02", "11", "20", "22"]);

// 最後の一枚: 空いた1マスを選び、足りない数の札を置くと、盤全体がそろう
build({
  name: "last-tablet",
  period: 5200,
  givenCells: CORNERS_AND_CENTER,
  startEmpty: new Set(["01"]),
  story(s) {
    const { period, add, hide, layers, tone: t } = s;
    // プレイ画面のクリアと同じく、行・縦の列・斜めの3段をなぞってから、盤全体を光らせる
    const SELECT = 300, APPEAR = 950, LAND = 1350, POP = 1720, FINISH = 2700;
    const SWEEPS = { row: 1450, column: 1800, diagonal: 2150 };
    const inner = s.cellInterior(0, 1);
    // 選んだマスを通る行と縦の列に、プレイ画面と同じ薄い色を1つの形で重ねる（交わるマスを二重に塗らない）
    const band = `<path d="M12 20h78v26H64v52H38V46H12Z" fill="${t.selectedLine}" class="${P}band"/>`;
    const sumBand = `<rect x="93" y="22" width="22" height="22" rx="3" fill="${t.selectedLine}" class="${P}band"/>`;
    layers.under.push(band);
    layers.sums.push(sumBand);
    hide("band");
    add("band", [[0, "opacity:0"], [SELECT, "opacity:0", "ease-out"], [SELECT + 120, "opacity:1"], [LAND, "opacity:1", "ease-in-out"], [LAND + 200, "opacity:0"], [period, "opacity:0"]]);
    layers.over.push(`<rect x="${inner.x + 1.5}" y="${inner.y + 1.5}" width="${inner.w - 3}" height="${inner.h - 3}" rx="2.5" fill="none" stroke="${t.selection}" stroke-width="3" class="${P}select"/>`);
    hide("select");
    add("select", [[0, "opacity:0"], [SELECT, "opacity:0", "ease-out"], [SELECT + 120, "opacity:1"], [APPEAR + 100, "opacity:1", "ease-in-out"], [APPEAR + 250, "opacity:0"], [period, "opacity:0"]]);
    s.lifted(0, 1, APPEAR, LAND, { lift: 1.4, shadowColor: t.tabletShadow });
    s.sum(0, [["6", 0, LAND], ["15", LAND, null]]);
    s.sum(1, [["15", 0, null]]);
    s.sum(2, [["15", 0, null]]);
    for (let i = 0; i < 3; i += 1) {
      s.glint(`glint-row-${i}`, { x: X0 + STEP * i, y: Y0, w: STEP, h: SIZE }, SWEEPS.row + 90 * i);
      s.glint(`glint-column-${i}`, { x: X0, y: Y0 + STEP * i, w: SIZE, h: STEP }, SWEEPS.column + 90 * i);
      const diagonalCells = [...new Set([i, 2 - i])].map((c) => s.cellRect(i, c));
      s.glint(`glint-diagonal-${i}`, diagonalCells, SWEEPS.diagonal + 90 * i);
    }
    for (let r = 0; r < 3; r += 1) s.pop(r, POP);
    s.glint("finish", { x: X0, y: Y0, w: SIZE, h: SIZE }, FINISH, { peak: 0.8, rise: 156, length: 520 });
  },
});

// 順に置いてそろえる: 札を置くたびに行の合計が増え、15 に届いた行から緑になる
build({
  name: "row-by-row",
  period: 5200,
  givenCells: CORNERS_AND_CENTER,
  startEmpty: new Set(["01", "10", "12", "21"]),
  story(s) {
    const order = [[0, 1], [1, 0], [1, 2], [2, 1]];
    const appear = order.map((_, k) => 300 + 520 * k);
    const land = appear.map((t) => t + 380);
    order.forEach(([r, c], k) => s.lifted(r, c, appear[k], land[k]));
    s.sum(0, [["6", 0, land[0]], ["15", land[0], null]]);
    s.sum(1, [["5", 0, land[1]], ["8", land[1], land[2]], ["15", land[2], null]]);
    s.sum(2, [["14", 0, land[3]], ["15", land[3], null]]);
    s.pop(0, land[0]);
    s.pop(1, land[2]);
    s.pop(2, land[3]);
    s.glint("finish", { x: X0, y: Y0, w: SIZE, h: SIZE }, 2500, { peak: 0.8, rise: 156, length: 520 });
  },
});
console.log("written");
