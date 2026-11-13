import type { HakoiriMusumePieceShape } from "@/games/hakoiri-musume/puzzle/board";

/**
 * 箱入り娘固有の色と陰影。桐の箱の中に、欅の木の駒が並ぶ姿にする。目標の駒（娘）だけは漆を塗り、金の字を入れて、ほかの駒と見分ける。
 * 箱の底は、縁と駒より暗い影の色にし、空いたマスが一目で読めるようにする。出口は箱の縁を底の色のまま切り欠いて、底が外へ抜けて見せる。
 * 光は左上の一つで、駒の面は左上が明るく、右下に落ち影を落とす。木の色はダークでも変えず、`dark:` は箱の落ち影にだけ付ける。
 * 共通UIの意味色（`primary`・`ring` 以外の状態色）は木の上に乗せない。
 */
export const hakoiriMusumeToneClassNames = {
  /**
   * 箱を置いた畳の地。盤の周りから見出しとブランドの帯までつなげる。桐の縁より緑に寄せた淡い灰色にし、縁と落ち影が浮いて見える
   * 明るさの差を残す。ダークでは箱の縁の明るさが変わらないので、地だけを暗くする。
   */
  tableSurface: "bg-[#dcdccf] dark:bg-[#22241f]",
  /** 桐の箱の縁。淡い木の色に、縦に通る細かな柾目を重ねる。 */
  boxRim:
    "bg-[#e3d1ac] bg-[repeating-linear-gradient(90deg,rgb(120_90_50/0.07)_0_1px,transparent_1px_5px),linear-gradient(160deg,#ecdcbc,#d6c196)]",
  /** 箱を置いた面に落ちる影と、縁の天面の小さな面取り。 */
  boxShadow:
    "shadow-[0_1px_1px_rgb(60_40_15/0.35),0_8px_18px_-4px_rgb(60_40_15/0.4),inset_1px_1px_0_rgb(255_250_235/0.6),inset_-1px_-1px_0_rgb(120_90_50/0.35)] dark:shadow-[0_1px_1px_rgb(0_0_0/0.7),0_10px_22px_-4px_rgb(0_0_0/0.75),inset_1px_1px_0_rgb(255_250_235/0.6),inset_-1px_-1px_0_rgb(120_90_50/0.35)]",
  /** 箱の底。縁の内側に落ちる影で、縁より低い所に見せる。 */
  boxFloor:
    "bg-[#6f5a3f] shadow-[inset_0_3px_6px_rgb(30_18_5/0.55),inset_0_0_0_1px_rgb(30_18_5/0.35)]",
  /**
   * 出口の切り欠き。箱の底の色から、縁の外の、箱を置いた畳の地（`tableSurface`）の色へ移し、溝ではなく外へ抜けて見せる。
   * 切り欠いた縁の両側の木口に明るい線を入れる。出口のある辺ごとに、移す向きと木口の線の向きを変える。
   */
  exitOpening: {
    bottom:
      "bg-[linear-gradient(180deg,#6f5a3f,#dcdccf)] dark:bg-[linear-gradient(180deg,#6f5a3f,#22241f)] shadow-[inset_0_3px_4px_-2px_rgb(30_18_5/0.55),inset_1.5px_0_0_rgb(255_246_225/0.7),inset_-1.5px_0_0_rgb(255_246_225/0.7)]",
    top: "bg-[linear-gradient(0deg,#6f5a3f,#dcdccf)] dark:bg-[linear-gradient(0deg,#6f5a3f,#22241f)] shadow-[inset_0_-3px_4px_-2px_rgb(30_18_5/0.55),inset_1.5px_0_0_rgb(255_246_225/0.7),inset_-1.5px_0_0_rgb(255_246_225/0.7)]",
    right:
      "bg-[linear-gradient(90deg,#6f5a3f,#dcdccf)] dark:bg-[linear-gradient(90deg,#6f5a3f,#22241f)] shadow-[inset_3px_0_4px_-2px_rgb(30_18_5/0.55),inset_0_1.5px_0_rgb(255_246_225/0.7),inset_0_-1.5px_0_rgb(255_246_225/0.7)]",
    left: "bg-[linear-gradient(270deg,#6f5a3f,#dcdccf)] dark:bg-[linear-gradient(270deg,#6f5a3f,#22241f)] shadow-[inset_-3px_0_4px_-2px_rgb(30_18_5/0.55),inset_0_1.5px_0_rgb(255_246_225/0.7),inset_0_-1.5px_0_rgb(255_246_225/0.7)]",
  },
  /** 目標の駒が抜け切ったときに出口の縁に差す光。出口の外の端から、箱の底へ向けて薄れる。出口のある辺ごとに向きを変える。 */
  exitLight: {
    bottom:
      "origin-bottom bg-[radial-gradient(ellipse_70%_100%_at_50%_100%,rgb(255_242_210/0.95),rgb(255_242_210/0)_80%)]",
    top: "origin-top bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgb(255_242_210/0.95),rgb(255_242_210/0)_80%)]",
    right:
      "origin-right bg-[radial-gradient(ellipse_100%_70%_at_100%_50%,rgb(255_242_210/0.95),rgb(255_242_210/0)_80%)]",
    left: "origin-left bg-[radial-gradient(ellipse_100%_70%_at_0%_50%,rgb(255_242_210/0.95),rgb(255_242_210/0)_80%)]",
  },
  /** 壁のマス。箱の縁と同じ桐を、底から立ち上げて見せる。縁より少し暗い木口の陰で、駒の入れない所と分かるようにする。 */
  wall: "bg-[#ddc9a0] bg-[repeating-linear-gradient(90deg,rgb(120_90_50/0.07)_0_1px,transparent_1px_5px),linear-gradient(160deg,#ead8b6,#cfb98c)] shadow-[inset_1px_1px_0_rgb(255_250_235/0.6),inset_-1px_-1px_0_rgb(120_90_50/0.4),0_1px_2px_rgb(30_18_5/0.45)]",
  /** 欅の駒の面取りの照り・陰と、底に落ちる影。面の木目と地は `getWoodPieceBackground` で描く。 */
  woodPiece:
    "shadow-[inset_1px_1px_0_rgb(255_235_200/0.55),inset_-1px_-1px_0_rgb(80_45_10/0.45),0_2px_3px_rgb(30_18_5/0.45)]",
  /**
   * 目標の駒の面。目標が1つなら朱漆に金の「娘」、2つなら1つ目を朱漆に「姉」、2つ目を藍漆に「妹」とし、色と字の両方で見分ける。
   * 2つのときは、それぞれの出口にも同じ漆の色の筋（`exitMark`）を入れて、どの駒をどの出口へ運ぶかを示す。
   */
  targetPieces: [
    "bg-[linear-gradient(145deg,#cf4a36,#a8301f_55%,#8a2416)] shadow-[inset_1px_1px_0_rgb(255_200_180/0.5),inset_-1px_-1px_0_rgb(60_10_5/0.5),0_2px_4px_rgb(30_10_5/0.5)]",
    "bg-[linear-gradient(145deg,#3f5f9a,#2c4677_55%,#1f3359)] shadow-[inset_1px_1px_0_rgb(200_215_255/0.45),inset_-1px_-1px_0_rgb(5_10_40/0.55),0_2px_4px_rgb(5_10_30/0.5)]",
  ],
  /** 目標が2つのときに出口へ入れる、目標の駒と同じ漆の色の筋。 */
  exitMarks: ["bg-[#b23a26]", "bg-[#2c4677]"],
  /** 遊び方の図で、駒をなぞる指の道。木の上でも箱の底の上でも読めるよう、白く抜く。 */
  howToPlayTrace: "stroke-white/85",
  /** 目標の駒に入れた金の字。 */
  targetMark: "text-[#f3d488] [text-shadow:0_1px_0_rgb(40_10_5/0.6)]",
} as const;

/** つかんで持ち上げた駒の、箱の底へ深く落ちる影（CSS の `box-shadow` の値）。持ち上げを下ろす動きの始まりにも使う。 */
export const LIFTED_PIECE_SHADOW = "0 9px 16px -3px rgb(30 18 5 / 0.55)";

/**
 * 形に切り抜いた駒（L字）の、置いた駒の落ち影（CSS の `drop-shadow` の値）。長方形の駒の面の落ち影（`woodPiece`）と同じずれと濃さで、
 * 切り抜いた形から落とす。
 */
export const RESTING_OUTLINED_PIECE_SHADOW = "0 2px 3px rgb(30 18 5 / 0.45)";

/** 欅の駒の面の地の色（左上・中ほど・右下）。 */
const WOOD_PIECE_BASE_COLORS = [
  [217, 173, 108],
  [192, 138, 71],
  [168, 116, 58],
] as const;

/** 駒ごとに地の色の明るさを揺らす幅。同じ箱の駒を、同じ欅から切り出した別々の木に見せる。 */
const WOOD_PIECE_SHADE_RANGE = 0.03;

/** 種から 0 以上 1 未満の値を散らす。無理数の端数で、続く番号どうしが近い値にならないようにする。 */
function scatter(seed: number, step: number): number {
  return (((seed * step) % 1) + 1) % 1;
}

function getWoodPieceBase(seed: number): string {
  const shade = 1 + WOOD_PIECE_SHADE_RANGE * (scatter(seed, 0.754877) * 2 - 1);
  const [light, middle, dark] = WOOD_PIECE_BASE_COLORS.map(
    (color) =>
      `rgb(${color.map((channel) => Math.min(255, Math.round(channel * shade))).join(" ")})`,
  );
  return `linear-gradient(145deg,${light},${middle} 55%,${dark})`;
}

/**
 * 木目の SVG。木目の線（向きに細長い雑音）を、ゆるい雑音でずらしてうねらせる。種によっては節（木目に沿って細長い輪）を
 * 入れ、同じうねりでずらして木目になじませる。座標は1マスを 100 とし、駒の形のまま描く。
 * うねりで端の外の模様を引き込むので、模様は駒の外まで広げて描く。
 */
function getWoodGrainSvg(
  { columns, rows }: HakoiriMusumePieceShape,
  vertical: boolean,
  seed: number,
): string {
  const width = 100 * columns;
  const height = 100 * rows;
  const along = 0.005;
  const across = 0.07;
  const [grainX, grainY] = vertical ? [across, along] : [along, across];
  const [waveX, waveY] = vertical ? [0.006, 0.012] : [0.012, 0.006];
  const margin = { x: -width * 0.3, y: -height * 0.3 };
  const area = `x='${margin.x}' y='${margin.y}' width='${width * 1.6}' height='${height * 1.6}'`;
  const knotX = Math.round(scatter(seed, 0.618034) * width);
  const knotY = Math.round(scatter(seed + 0.3, 0.381966) * height);
  const [knotLong, knotShort] = vertical ? ["ry", "rx"] : ["rx", "ry"];
  const knot =
    seed % 3 === 0
      ? `<g fill='none' stroke='rgb(92,52,18)' opacity='0.4'><ellipse cx='${knotX}' cy='${knotY}' ${knotShort}='3' ${knotLong}='7' fill='rgb(92,52,18)' stroke='none'/><ellipse cx='${knotX}' cy='${knotY}' ${knotShort}='4.5' ${knotLong}='13.5' stroke-width='2.5'/><ellipse cx='${knotX}' cy='${knotY}' ${knotShort}='8' ${knotLong}='24' stroke-width='1.5'/></g>`
      : "";
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}' preserveAspectRatio='none'><filter id='g' filterUnits='userSpaceOnUse' ${area} color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='${waveX} ${waveY}' numOctaves='1' seed='${seed + 7}' result='wave'/><feTurbulence type='fractalNoise' baseFrequency='${grainX} ${grainY}' numOctaves='2' seed='${seed}' result='noise'/><feColorMatrix in='noise' type='matrix' values='0 0 0 0 0.36 0 0 0 0 0.2 0 0 0 0 0.07 1.6 0 0 0 -0.78' result='grain'/><feGaussianBlur in='SourceGraphic' stdDeviation='1.6' result='knot'/><feMerge result='wood'><feMergeNode in='grain'/><feMergeNode in='knot'/></feMerge><feDisplacementMap in='wood' in2='wave' scale='40' xChannelSelector='R' yChannelSelector='G'/></filter><g filter='url(#g)'><rect ${area} fill='none'/>${knot}</g></svg>`;
}

/**
 * 欅の駒の面。うねりと節のある木目を、左上から光を受けて右下へ暗くなる地に重ねる。木目の線は `grainAngle` の向きに走る
 * （0 は縦、90 は横）。`seed` で木目の模様と節の有無・位置と、地の明るさ（±3%）を変え、駒ごとに違う木に見せる。
 * 木目は駒の大きさいっぱいに描き、小さく描いても線が詰まりすぎない。
 */
export function getWoodPieceBackground(
  shape: HakoiriMusumePieceShape,
  grainAngle: 0 | 90,
  seed: number,
): string {
  const grain = encodeURIComponent(
    getWoodGrainSvg(shape, grainAngle === 0, seed),
  );
  return `url("data:image/svg+xml,${grain}") 0 0 / 100% 100%, ${getWoodPieceBase(seed)}`;
}
