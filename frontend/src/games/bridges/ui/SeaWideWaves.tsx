import { useId } from "react";
import { WavePattern } from "@/games/bridges/ui/WavePattern";

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
