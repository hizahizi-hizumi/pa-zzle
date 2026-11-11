import { useId } from "react";

import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

/**
 * 波の印を散らす区画。印の位置をばらした大きな区画を2つ、互いに割り切れない寸法で重ね、区画の繰り返しが格子に見えないようにする。
 * スマホの画面の幅では区画が1度も繰り返さず、PC の画面でも横に3〜4度にとどまる。
 * 寸法は `unit` を掛ける前の値で、プレイ画面の海では px、絵の中の海ではマス幅の 1/40 ほどにする。
 * 印は大小2段の大きさにし、数を絞って海の面を静かに保つ。
 * - `marks`: 区画の中の波の印。`x`・`y` は左端、`large` は大きい印か。
 */
const waveTiles = [
  {
    width: 397,
    height: 271,
    marks: [
      { x: 22, y: 31, large: true },
      { x: 268, y: 19, large: false },
      { x: 330, y: 152, large: false },
      { x: 141, y: 214, large: true },
    ],
  },
  {
    width: 541,
    height: 353,
    marks: [
      { x: 103, y: 128, large: false },
      { x: 389, y: 61, large: true },
      { x: 462, y: 287, large: false },
    ],
  },
] as const;

/** PC の広い画面で、盤面の外の海に足す波の印の区画。盤面の外の広い面が空き地に見えないよう、印の密度を上げる。 */
const wideWaveTile = {
  width: 233,
  height: 181,
  marks: [
    { x: 31, y: 42, large: false },
    { x: 152, y: 97, large: true },
    { x: 78, y: 158, large: false },
  ],
} as const;

/** 印の大きさ（横幅）と線の太さ。大きい印は小さい印の 1.6 倍ほどにする。 */
const WAVE_SIZES = { small: 12, large: 20 } as const;
const WAVE_STROKE_WIDTH = 1.5;

type WaveTile = {
  width: number;
  height: number;
  marks: readonly { x: number; y: number; large: boolean }[];
};

/** 波の印を1つ置く、横に2つ山を持つ短い線。`x`・`y` は左端。 */
function wavePath(x: number, y: number, size: number): string {
  const half = size / 2;
  return `M${x} ${y}q${half / 2} ${-half / 2} ${half} 0t${half} 0`;
}

function WavePattern({
  id,
  tile,
  unit,
}: {
  id: string;
  tile: WaveTile;
  unit: number;
}) {
  return (
    <pattern
      id={id}
      width={tile.width * unit}
      height={tile.height * unit}
      patternUnits="userSpaceOnUse"
    >
      <g
        fill="none"
        strokeWidth={WAVE_STROKE_WIDTH * unit}
        strokeLinecap="round"
        className={bridgesToneClassNames.seaWave}
      >
        {tile.marks.map((mark) => (
          <path
            key={`${mark.x}:${mark.y}`}
            d={wavePath(
              mark.x * unit,
              mark.y * unit,
              (mark.large ? WAVE_SIZES.large : WAVE_SIZES.small) * unit,
            )}
          />
        ))}
      </g>
    </pattern>
  );
}

/**
 * 海の深さの差の、弱い明暗のむら。描く面に対する割合で、浅い所（明るい）と深い所（暗い）を大きくぼかして置く。
 * - `shoal`: 浅い所か。
 * - `x`・`y`・`r`: 面に対する中心の位置と広がり。
 */
const depthPatches = [
  { shoal: true, x: 0.18, y: 0.22, r: 0.42 },
  { shoal: false, x: 0.82, y: 0.35, r: 0.5 },
  { shoal: true, x: 0.7, y: 0.82, r: 0.38 },
  { shoal: false, x: 0.15, y: 0.78, r: 0.4 },
] as const;
/** むらの濃さ。平常の海の静けさを崩さないよう、ごく薄く重ねる。 */
const DEPTH_OPACITY = { shoal: 0.12, deep: 0.1 } as const;

/** 画面の上の端で、むらを消しておく高さ（px）。ブランドの帯の海の無地と、継ぎ目なくつなぐ。 */
const DEPTH_TOP_FADE_PX = 120;

/**
 * SVG の中に、海の深さの差のむらと、海に散らす動かない波の印を描く。区画の繰り返しを崩し、印の大きさを2段にする。
 * `unit` は区画の寸法に掛ける倍率。`fadesTop` なら、むらを上の端で消し、上に続く無地の海とつなぐ。
 */
export function SeaWaves({
  unit,
  fadesTop = false,
}: {
  unit: number;
  fadesTop?: boolean;
}) {
  const id = useId();
  return (
    <>
      <defs>
        {fadesTop && (
          <>
            <linearGradient
              id={`${id}-top-fade`}
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={0}
              x2={0}
              y2={DEPTH_TOP_FADE_PX}
            >
              <stop offset={0} stopColor="black" />
              <stop offset={1} stopColor="white" />
            </linearGradient>
            <mask id={`${id}-top-mask`}>
              <rect width="100%" height="100%" fill={`url(#${id}-top-fade)`} />
            </mask>
          </>
        )}
        {depthPatches.map(({ shoal, x, y, r }, index) => (
          <radialGradient
            key={`${x}:${y}`}
            id={`${id}-depth-${index}`}
            cx={x}
            cy={y}
            r={r}
          >
            <stop
              offset={0}
              stopOpacity={shoal ? DEPTH_OPACITY.shoal : DEPTH_OPACITY.deep}
              className={
                shoal
                  ? bridgesToneClassNames.seaShoal
                  : bridgesToneClassNames.seaDeep
              }
            />
            <stop
              offset={1}
              stopOpacity={0}
              className={
                shoal
                  ? bridgesToneClassNames.seaShoal
                  : bridgesToneClassNames.seaDeep
              }
            />
          </radialGradient>
        ))}
        {waveTiles.map((tile, index) => (
          <WavePattern
            key={`${tile.width}x${tile.height}`}
            id={`${id}-${index}`}
            tile={tile}
            unit={unit}
          />
        ))}
      </defs>
      <g mask={fadesTop ? `url(#${id}-top-mask)` : undefined}>
        {depthPatches.map(({ x, y }, index) => (
          <rect
            key={`${x}:${y}`}
            width="100%"
            height="100%"
            fill={`url(#${id}-depth-${index})`}
          />
        ))}
      </g>
      {waveTiles.map((tile, index) => (
        <rect
          key={`${tile.width}x${tile.height}`}
          width="100%"
          height="100%"
          fill={`url(#${id}-${index})`}
        />
      ))}
    </>
  );
}

/** SVG の中に、PC の広い画面で盤面の外の海に足す波の印を描く。見せる範囲は置く側で決める。 */
export function SeaWideWaves() {
  const id = useId();
  return (
    <>
      <defs>
        <WavePattern id={id} tile={wideWaveTile} unit={1} />
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </>
  );
}
