import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

const TUBE_CAPACITY = 4;

/** 1種類の試薬で満ちた試験管。ゴム栓で閉じる。 */
export function isSealedTube(contents: WaterSortBottle): boolean {
  const first = contents[0];
  return (
    contents.length === TUBE_CAPACITY &&
    first !== undefined &&
    contents.every((colorIndex) => colorIndex === first)
  );
}
