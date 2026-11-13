import { useId } from "react";

import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

/**
 * 印の位置をばらした大きな区画を2つ、互いに割り切れない寸法で重ね、区画の繰り返しが格子に見えないようにする。
 * スマホの画面の幅では区画が1度も繰り返さず、PC の画面でも横に3〜4度にとどまる。
 * 寸法は `unit` を掛ける前の値で、プレイ画面の海では px、絵の中の海ではマス幅の 1/40 ほどにする。
 * 印は大小2段の大きさにし、数を絞って海の面を静かに保つ。
 * - `marks`: `x`・`y` は印の左端。
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

/** 盤面の外の広い面が空き地に見えないよう、印の密度を上げる。 */
const wideWaveTile = {
  width: 233,
  height: 181,
  marks: [
    { x: 31, y: 42, large: false },
    { x: 152, y: 97, large: true },
    { x: 78, y: 158, large: false },
  ],
} as const;

const WAVE_WIDTHS = { small: 12, large: 20 } as const;
const WAVE_STROKE_WIDTH = 2;

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
              (mark.large ? WAVE_WIDTHS.large : WAVE_WIDTHS.small) * unit,
            )}
          />
        ))}
      </g>
    </pattern>
  );
}

export function SeaWaves({ unit }: { unit: number }) {
  const id = useId();
  return (
    <>
      <defs>
        {waveTiles.map((tile, index) => (
          <WavePattern
            key={`${tile.width}x${tile.height}`}
            id={`${id}-${index}`}
            tile={tile}
            unit={unit}
          />
        ))}
      </defs>
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

/** 見せる範囲は置く側で決める。 */
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
