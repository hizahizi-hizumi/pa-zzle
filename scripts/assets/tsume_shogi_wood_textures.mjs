// 詰将棋の盤・駒台・駒の木目の画像（frontend/src/games/tsume-shogi/assets/wood/*.webp）を作り直す。
//
// 木目は SVG の feTurbulence で手続き生成し、Chromium で画素にして PNG に書き出し、Pillow で WebP にする。
// 外部の画像素材は使わない。実行時に生成の描画を走らせないよう、表示の約2倍の大きさで画像に焼き込む。
//
//   PLAYWRIGHT_CORE=<playwright-core のディレクトリ> CHROMIUM=<chrome の実行ファイル> \
//     node scripts/assets/tsume_shogi_wood_textures.mjs
//
// Pillow（WebP に対応したもの）を入れた python3 が要る。柾目は、年輪を1本ずつ早材から晩材へ濃くなって細い線で終わる輪郭で描き、
// 年輪の間隔は幅の中でゆっくり変える。
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? "playwright-core");

const OUTPUT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../frontend/src/games/tsume-shogi/assets/wood",
);

const RINGS_PER_RAMP = 8;
const RING_STRENGTH = [1, 0.55, 0.85, 0.4, 0.95, 0.7, 0.5, 0.8];
const LATEWOOD = [0.3, 0.15, 0.4, 0.1, 0.25, 0.35, 0.12, 0.2];

function toRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255].map((channel) =>
    channel.toFixed(3),
  );
}

function tintMatrix(hex, alphaRow) {
  const [red, green, blue] = toRgb(hex);
  return `0 0 0 0 ${red} 0 0 0 0 ${green} 0 0 0 0 ${blue} ${alphaRow}`;
}

/** 年輪8本分の濃さの表。早材の淡い色から晩材へ濃くなり、細い線で終わる。 */
function ringProfile() {
  const values = [];
  for (let index = 0; index < RINGS_PER_RAMP; index++) {
    const strength = RING_STRENGTH[index];
    const late = LATEWOOD[index];
    values.push(0, 0, 0.03, late * 0.3, late * 0.6, late, strength * 0.6, strength, strength * 0.12);
  }
  values.push(0);
  return values.map((value) => value.toFixed(3)).join(" ");
}

/** 年輪8本ずつの勾配を、幅の中で間隔がゆっくり変わるように並べる。 */
function rampStops(ramps, variation, phase) {
  const widths = Array.from(
    { length: ramps },
    (_, index) =>
      1 +
      variation * Math.sin((index / ramps) * Math.PI * 2 * 1.3 + phase) +
      variation * 0.5 * Math.sin((index / ramps) * Math.PI * 2 * 3.1 + phase * 2),
  );
  const total = widths.reduce((sum, width) => sum + width, 0);
  let at = 0;
  const stops = [];
  for (const width of widths) {
    const start = at / total;
    at += width;
    const end = at / total;
    stops.push(
      `<stop offset='${start.toFixed(5)}' stop-color='#000'/>`,
      `<stop offset='${end.toFixed(5)}' stop-color='#f00'/>`,
    );
  }
  return stops.join("");
}

function woodSvg(texture) {
  const {
    width,
    height,
    vertical = true,
    seed,
    rings,
    wobble,
    wobbleFrequency,
    lineAlpha,
    lineVariation = 1.6,
    fiberAlpha,
    speckAlpha,
    blotchAlpha,
    variation = 0.35,
  } = texture;
  const ramps = Math.max(1, Math.round(rings / RINGS_PER_RAMP));
  const gradient = vertical ? "x1='0' y1='0' x2='1' y2='0'" : "x1='0' y1='0' x2='0' y2='1'";
  const [across, along] = wobbleFrequency;
  const wobbleBase = vertical ? `${across} ${along}` : `${along} ${across}`;
  const fiberBase = vertical ? "0.9 0.012" : "0.012 0.9";
  const blotchBase = vertical ? "0.004 0.0015" : "0.0015 0.004";
  const lineBase = vertical ? "0.008 0.0006" : "0.0006 0.008";
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
<linearGradient id='g' ${gradient}>${rampStops(ramps, variation, seed)}</linearGradient>
<filter id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>
<feTurbulence type='fractalNoise' baseFrequency='${wobbleBase}' numOctaves='2' seed='${seed}' result='n'/>
<feComposite in='SourceGraphic' in2='n' operator='arithmetic' k2='1' k3='${wobble * 2}' k4='${-wobble}' result='v0'/>
<feColorMatrix in='v0' result='v' values='1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1'/>
<feComponentTransfer in='v' result='l'><feFuncR type='table' tableValues='${ringProfile()}'/></feComponentTransfer>
<feColorMatrix in='l' result='ringsRaw' values='${tintMatrix(texture.line, `${lineAlpha} 0 0 0 0`)}'/>
<feTurbulence type='fractalNoise' baseFrequency='${lineBase}' numOctaves='2' seed='${seed + 23}' result='lf'/>
<feColorMatrix in='lf' result='lfAlpha' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${lineVariation} 0 0 0 ${-lineVariation / 2 + 0.5}'/>
<feComposite in='ringsRaw' in2='lfAlpha' operator='in' result='rings'/>
<feTurbulence type='fractalNoise' baseFrequency='${fiberBase}' numOctaves='2' seed='${seed + 11}' result='s'/>
<feColorMatrix in='s' result='fiber' values='${tintMatrix(texture.line, `${fiberAlpha * 4} 0 0 0 ${-fiberAlpha * 1.7}`)}'/>
<feTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='1' seed='${seed + 17}' result='k'/>
<feColorMatrix in='k' result='speck' values='${tintMatrix(texture.line, `${speckAlpha * 4} 0 0 0 ${-speckAlpha * 1.6}`)}'/>
<feTurbulence type='fractalNoise' baseFrequency='${blotchBase}' numOctaves='2' seed='${seed + 5}' result='m'/>
<feColorMatrix in='m' result='light' values='${tintMatrix(texture.light, `${blotchAlpha * 4} 0 0 0 ${-blotchAlpha * 2}`)}'/>
<feColorMatrix in='m' result='shade' values='${tintMatrix(texture.shade, `${-blotchAlpha * 4} 0 0 0 ${blotchAlpha * 2}`)}'/>
<feFlood flood-color='${texture.base}' result='base'/>
<feMerge><feMergeNode in='base'/><feMergeNode in='light'/><feMergeNode in='shade'/><feMergeNode in='rings'/><feMergeNode in='fiber'/><feMergeNode in='speck'/></feMerge>
</filter>
<rect width='100%' height='100%' fill='url(#g)' filter='url(#f)'/>
</svg>`;
}

const kaya = { base: "#e9bd6c", light: "#f6d892", shade: "#c9913f", line: "#a8702e" };

const textures = [
  // 盤の天面（榧の天柾）。390px の画面で盤は約 360px なので、その約2倍で描く。
  {
    name: "kaya-board",
    quality: 88,
    width: 800,
    height: 880,
    ...kaya,
    seed: 3,
    rings: 140,
    variation: 0.5,
    wobble: 0.25,
    wobbleFrequency: [0.012, 0.0012],
    lineAlpha: 0.55,
    lineVariation: 1.8,
    fiberAlpha: 0.05,
    speckAlpha: 0.035,
    blotchAlpha: 0.25,
  },
  // 駒台の天面。盤と同じ材を長手方向に使う（濃さは表示の側で一段落とす）。
  {
    name: "kaya-komadai",
    quality: 85,
    width: 800,
    height: 140,
    vertical: false,
    ...kaya,
    seed: 9,
    rings: 40,
    wobble: 0.22,
    wobbleFrequency: [0.04, 0.002],
    lineAlpha: 0.45,
    fiberAlpha: 0.05,
    speckAlpha: 0.035,
    blotchAlpha: 0.22,
  },
  // 柘植の駒の面。盤より少し濃い蜂蜜色で、細い柾目。駒ごとに模様の向きと位置を変えて使う。
  {
    name: "tsuge-piece",
    quality: 88,
    width: 320,
    height: 352,
    base: "#e8c47c",
    light: "#f3d696",
    shade: "#d6ad62",
    line: "#b0813c",
    seed: 31,
    rings: 90,
    variation: 0.45,
    wobble: 0.3,
    wobbleFrequency: [0.05, 0.006],
    lineAlpha: 0.3,
    fiberAlpha: 0.035,
    speckAlpha: 0.02,
    blotchAlpha: 0.14,
  },
];

const CONVERT_TO_WEBP = `
import sys
from PIL import Image
source, target, quality = sys.argv[1], sys.argv[2], int(sys.argv[3])
Image.open(source).convert("RGB").save(target, "WEBP", quality=quality, method=6)
`;

const workDirectory = mkdtempSync(join(tmpdir(), "tsume-shogi-wood-"));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
try {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  for (const texture of textures) {
    const source = `data:image/svg+xml,${encodeURIComponent(woodSvg(texture))}`;
    await page.setContent(
      `<body style="margin:0"><img id="wood" src="${source}" width="${texture.width}" height="${texture.height}"></body>`,
    );
    await page.waitForTimeout(400);
    const png = join(workDirectory, `${texture.name}.png`);
    await page.locator("#wood").screenshot({ path: png });
    const converted = spawnSync(
      "python3",
      ["-c", CONVERT_TO_WEBP, png, join(OUTPUT_DIRECTORY, `${texture.name}.webp`), String(texture.quality)],
      { stdio: "inherit" },
    );
    if (converted.status !== 0) throw new Error(`${texture.name} を WebP にできない`);
    console.log(texture.name);
  }
} finally {
  await browser.close();
  rmSync(workDirectory, { recursive: true, force: true });
}
