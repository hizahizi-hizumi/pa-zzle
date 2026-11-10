import { useId } from "react";

import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

/**
 * 波の印を散らす区画。印の位置をばらした大きな区画を2つ、互いに割り切れない寸法で重ね、区画の繰り返しが格子に見えないようにする。
 * スマホの画面の幅では区画が1度も繰り返さず、PC の画面でも横に3〜4度にとどまる。
 * 寸法は `unit` を掛ける前の値で、プレイ画面の海では px、絵の中の海ではマス幅の 1/40 ほどにする。
 * - `marks`: 区画の中の波の印。`x`・`y` は左端、`size` は横幅、`opacity` は印ごとの濃さの割合。
 */
const waveTiles = [
  {
    width: 397,
    height: 271,
    marks: [
      { x: 22, y: 31, size: 16, opacity: 1 },
      { x: 141, y: 88, size: 11, opacity: 0.6 },
      { x: 268, y: 19, size: 13, opacity: 0.8 },
      { x: 330, y: 152, size: 18, opacity: 0.9 },
      { x: 77, y: 196, size: 12, opacity: 0.7 },
      { x: 205, y: 238, size: 15, opacity: 0.85 },
    ],
  },
  {
    width: 541,
    height: 353,
    marks: [
      { x: 103, y: 128, size: 21, opacity: 0.75 },
      { x: 389, y: 61, size: 10, opacity: 0.55 },
      { x: 248, y: 301, size: 19, opacity: 0.7 },
      { x: 462, y: 247, size: 12, opacity: 0.6 },
      { x: 12, y: 322, size: 14, opacity: 0.65 },
    ],
  },
] as const;

const WAVE_STROKE_WIDTH = 1.5;

/** 波の印を1つ置く、横に2つ山を持つ短い線。`x`・`y` は左端。 */
function wavePath(x: number, y: number, size: number): string {
  const half = size / 2;
  return `M${x} ${y}q${half / 2} ${-half / 2} ${half} 0t${half} 0`;
}

/**
 * SVG の中に、海に散らす動かない波の印を描く。区画の繰り返しを崩し、印の大きさと濃さを揃えない。
 * `unit` は区画の寸法に掛ける倍率。
 */
export function SeaWaves({ unit }: { unit: number }) {
  const id = useId();
  return (
    <>
      <defs>
        {waveTiles.map((tile, index) => (
          <pattern
            key={`${tile.width}x${tile.height}`}
            id={`${id}-${index}`}
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
                  d={wavePath(mark.x * unit, mark.y * unit, mark.size * unit)}
                  opacity={mark.opacity}
                />
              ))}
            </g>
          </pattern>
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
