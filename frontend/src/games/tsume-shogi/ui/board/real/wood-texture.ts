import kayaBoardUrl from "@/games/tsume-shogi/assets/wood/kaya-board.webp";
import kayaSideUrl from "@/games/tsume-shogi/assets/wood/kaya-side.webp";
import komadaiUrl from "@/games/tsume-shogi/assets/wood/komadai.webp";
import tsugePieceUrl from "@/games/tsume-shogi/assets/wood/tsuge-piece.webp";
import { tsumeShogiWoodSource } from "@/games/tsume-shogi/ui/board-style";

/**
 * 木目の手続き生成。SVG の feTurbulence だけで描き、data URI の背景画像にする。
 * 画像はベクターとして表示の大きさで描かれるので、3倍の画面でも引き伸ばしでぼけない。一度描けば駒が動いても描き直さない。
 * 横に 0→1 の勾配を並べ、低い周波数のノイズで少し揺らしてから年輪ごとの輪郭で切り、柾目の平行な筋にする。
 * 年輪は早材から晩材へ緩やかに濃くなり細い線で終わる。年輪ごとに濃さと晩材の幅を変え、規則的な縞に見せない。
 * その上に繊維の細い筋、微細な斑、穏やかな色むらを重ねる。
 */
type WoodOptions = {
  width: number;
  height: number;
  base: string;
  light: string;
  shade: string;
  line: string;
  seed: number;
  /** 幅（筋が横に流れるなら高さ）あたりの年輪の数。 */
  rings: number;
  wobble: number;
  /** 揺らしのノイズの周波数。筋に直交する向き・沿う向きの順。 */
  wobbleFrequency: readonly [number, number];
  lineAlpha: number;
  fiberAlpha: number;
  speckAlpha: number;
  blotchAlpha: number;
  direction: "vertical" | "horizontal";
};

const RINGS_PER_RAMP = 8;
const RING_STRENGTHS = [1, 0.55, 0.85, 0.4, 0.95, 0.7, 0.5, 0.8] as const;
const RING_LATEWOOD = [0.3, 0.15, 0.4, 0.1, 0.25, 0.35, 0.12, 0.2] as const;

function ringProfile(): string {
  const values = RING_STRENGTHS.flatMap((strength, index) => {
    const late = RING_LATEWOOD[index] ?? 0;
    return [
      0,
      0,
      0.03,
      late * 0.3,
      late * 0.6,
      late,
      strength * 0.6,
      strength,
      strength * 0.12,
    ];
  });
  values.push(0);
  return values.map((value) => value.toFixed(3)).join(" ");
}

function rgb(hex: string): string[] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [
    (value >> 16) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ].map((channel) => channel.toFixed(3));
}

/** 不透明度を持たない色の行列。`alpha` 行だけで、元の画素のどの成分を不透明度にするかを決める。 */
function tint(hex: string, alphaRow: string): string {
  const [r, g, b] = rgb(hex);
  return `0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${alphaRow}`;
}

function createWoodSvg(options: WoodOptions): string {
  const { width, height, seed, direction } = options;
  const vertical = direction === "vertical";
  const ramps = Math.max(1, Math.round(options.rings / RINGS_PER_RAMP));
  const end = (1 / ramps).toFixed(5);
  const gradient = vertical
    ? `x1='0' y1='0' x2='${end}' y2='0'`
    : `x1='0' y1='0' x2='0' y2='${end}'`;
  const [across, along] = options.wobbleFrequency;
  const wobbleFrequency = vertical
    ? `${across} ${along}`
    : `${along} ${across}`;
  const fiberFrequency = vertical ? "0.9 0.012" : "0.012 0.9";
  const blotchFrequency = vertical ? "0.004 0.0015" : "0.0015 0.004";
  const { wobble, lineAlpha, fiberAlpha, speckAlpha, blotchAlpha } = options;
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' preserveAspectRatio='none'>
<linearGradient id='g' spreadMethod='repeat' ${gradient}><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#f00'/></linearGradient>
<filter id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>
<feTurbulence type='fractalNoise' baseFrequency='${wobbleFrequency}' numOctaves='2' seed='${seed}' result='n'/>
<feComposite in='SourceGraphic' in2='n' operator='arithmetic' k2='1' k3='${wobble * 2}' k4='${-wobble}' result='v0'/>
<feColorMatrix in='v0' result='v' values='1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1'/>
<feComponentTransfer in='v' result='l'><feFuncR type='table' tableValues='${ringProfile()}'/></feComponentTransfer>
<feColorMatrix in='l' result='rings' values='${tint(options.line, `${lineAlpha} 0 0 0 0`)}'/>
<feTurbulence type='fractalNoise' baseFrequency='${fiberFrequency}' numOctaves='2' seed='${seed + 11}' result='s'/>
<feColorMatrix in='s' result='fiber' values='${tint(options.line, `${fiberAlpha * 4} 0 0 0 ${-fiberAlpha * 1.7}`)}'/>
<feTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='1' seed='${seed + 17}' result='k'/>
<feColorMatrix in='k' result='speck' values='${tint(options.line, `${speckAlpha * 4} 0 0 0 ${-speckAlpha * 1.6}`)}'/>
<feTurbulence type='fractalNoise' baseFrequency='${blotchFrequency}' numOctaves='2' seed='${seed + 5}' result='m'/>
<feColorMatrix in='m' result='light' values='${tint(options.light, `${blotchAlpha * 4} 0 0 0 ${-blotchAlpha * 2}`)}'/>
<feColorMatrix in='m' result='shade' values='${tint(options.shade, `${-blotchAlpha * 4} 0 0 0 ${blotchAlpha * 2}`)}'/>
<feFlood flood-color='${options.base}' result='base'/>
<feMerge><feMergeNode in='base'/><feMergeNode in='light'/><feMergeNode in='shade'/><feMergeNode in='rings'/><feMergeNode in='fiber'/><feMergeNode in='speck'/></feMerge>
</filter>
<rect width='100%' height='100%' fill='url(#g)' filter='url(#f)'/>
</svg>`;
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** 榧の天柾。黄金色の地に、細く平行で間隔のほぼそろった柾目が縦に通る。 */
const kayaBoardTop = toDataUri(
  createWoodSvg({
    width: 400,
    height: 440,
    base: "#e9bd6c",
    light: "#f6d892",
    shade: "#c9913f",
    line: "#a8702e",
    seed: 3,
    rings: 110,
    wobble: 0.22,
    wobbleFrequency: [0.02, 0.002],
    lineAlpha: 0.5,
    fiberAlpha: 0.05,
    speckAlpha: 0.035,
    blotchAlpha: 0.25,
    direction: "vertical",
  }),
);

/** 盤の手前の側面。天面と同じ材の、陰になった面。筋は横に流れる。 */
const kayaBoardSide = toDataUri(
  createWoodSvg({
    width: 400,
    height: 24,
    base: "#a8733a",
    light: "#b9844a",
    shade: "#8a5a26",
    line: "#6e4518",
    seed: 21,
    rings: 6,
    wobble: 0.2,
    wobbleFrequency: [0.08, 0.004],
    lineAlpha: 0.35,
    fiberAlpha: 0.04,
    speckAlpha: 0.03,
    blotchAlpha: 0.2,
    direction: "horizontal",
  }),
);

/** 駒台。盤と同じ系統の、一段濃い榧。長手方向に柾目が通る。 */
const komadaiTop = toDataUri(
  createWoodSvg({
    width: 400,
    height: 64,
    base: "#d29a52",
    light: "#e0ae68",
    shade: "#b07a38",
    line: "#8e5a22",
    seed: 9,
    rings: 18,
    wobble: 0.22,
    wobbleFrequency: [0.08, 0.004],
    lineAlpha: 0.45,
    fiberAlpha: 0.05,
    speckAlpha: 0.035,
    blotchAlpha: 0.22,
    direction: "horizontal",
  }),
);

/** 柘植の駒の面（駒の座標 0.1mm で 300×330）。盤と別の木に見えるよう淡黄で彩度を上げ、筋は盤の 1/3 の濃さ。 */
const tsugePieceFace = toDataUri(
  createWoodSvg({
    width: 300,
    height: 330,
    base: "#e8cc8a",
    light: "#f4dea6",
    shade: "#d8b56e",
    line: "#b88c45",
    seed: 31,
    rings: 26,
    wobble: 0.2,
    wobbleFrequency: [0.03, 0.004],
    lineAlpha: 0.17,
    fiberAlpha: 0.025,
    speckAlpha: 0.02,
    blotchAlpha: 0.15,
    direction: "vertical",
  }),
);

/**
 * 盤・駒台・駒に敷く木目と、画像が読み込まれる前に敷いておく平均の色。
 * `procedural`（既定）は上の手続き生成。`photo` は比較用の写真由来（Poly Haven「Wood Table 001」、CC0）。
 */
export const tsumeShogiWoodTextures =
  tsumeShogiWoodSource === "photo"
    ? {
        boardTop: kayaBoardUrl,
        boardSide: kayaSideUrl,
        komadaiTop: komadaiUrl,
        komadaiSide: kayaSideUrl,
        pieceFace: tsugePieceUrl,
      }
    : {
        boardTop: kayaBoardTop,
        boardSide: kayaBoardSide,
        komadaiTop,
        komadaiSide: kayaBoardSide,
        pieceFace: tsugePieceFace,
      };
