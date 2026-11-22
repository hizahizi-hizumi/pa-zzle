import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

/**
 * グラスの形を、盤面のボトルの枠（高さ）に対する割合で表す。
 * 4段の層が同じ高さで数えられるよう、液の入る筒はまっすぐにし、形の個性は厚い底で出す。
 */
export const BAR_GLASS = {
  /** 満ちたときの液面（上から）。縁の下に少しだけ空ける。 */
  liquidTop: 0.06,
  /** 厚いガラスの底の上面（上から）。 */
  baseTop: 0.89,
  /** 側面のガラスの厚さ（幅に対する割合）。 */
  wallInset: 0.05,
} as const;

const BOTTLE_CAPACITY = 4;

/** 1段の高さ（枠の高さに対する割合）。 */
export const BAR_GLASS_SLOT =
  (BAR_GLASS.baseTop - BAR_GLASS.liquidTop) / BOTTLE_CAPACITY;

/** `layerCount` 段まで入ったときの液面の高さ（枠の上からの割合）。 */
export function getBarLiquidSurface(layerCount: number): number {
  return BAR_GLASS.baseTop - BAR_GLASS_SLOT * layerCount;
}

export function isCompletedGlass(contents: WaterSortBottle): boolean {
  const first = contents[0];
  return (
    contents.length === BOTTLE_CAPACITY &&
    first !== undefined &&
    contents.every((colorIndex) => colorIndex === first)
  );
}

export type LiquidRun = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
};

/** 下から、同じ色の続く段をひとつの層にまとめる。同じ色どうしは境目なく溶け合って見せる。 */
export function getLiquidRuns(contents: WaterSortBottle): readonly LiquidRun[] {
  const runs: LiquidRun[] = [];
  contents.forEach((colorIndex, slot) => {
    const last = runs[runs.length - 1];
    if (last && last.colorIndex === colorIndex) {
      last.slotCount += 1;
      return;
    }
    runs.push({ colorIndex, startSlot: slot, slotCount: 1 });
  });
  return runs;
}
