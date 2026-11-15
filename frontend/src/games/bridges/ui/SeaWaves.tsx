import { useId } from "react";
import { WavePattern } from "@/games/bridges/ui/WavePattern";

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

type SeaWavesProps = {
  unit: number;
};

export function SeaWaves({ unit }: SeaWavesProps) {
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
