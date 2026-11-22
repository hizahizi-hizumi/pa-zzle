import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

export type LiquidRun = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
};

/** 同じ試薬が続く段は、ひとつの液として境目を描かない。 */
export function getLiquidRuns(contents: WaterSortBottle): LiquidRun[] {
  const runs: LiquidRun[] = [];
  contents.forEach((colorIndex, slotIndex) => {
    const last = runs[runs.length - 1];
    if (last && last.colorIndex === colorIndex) {
      last.slotCount += 1;
      return;
    }
    runs.push({ colorIndex, startSlot: slotIndex, slotCount: 1 });
  });
  return runs;
}
