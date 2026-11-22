import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

const JAR_CAPACITY = 4;

/** 1つの果実のシロップで満ちた瓶。蓋をして布をかぶせる。 */
export function isFilledJar(contents: WaterSortBottle): boolean {
  const first = contents[0];
  return (
    contents.length === JAR_CAPACITY &&
    contents.every((colorIndex) => colorIndex === first)
  );
}
