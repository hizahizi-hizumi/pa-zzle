import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

const BOTTLE_CAPACITY = 4;

/** 1本そろって、純粋な精に還ったフラスコか。 */
export function isSealedBottle(contents: WaterSortBottle): boolean {
  return (
    contents.length === BOTTLE_CAPACITY &&
    contents.every((colorIndex) => colorIndex === contents[0])
  );
}
