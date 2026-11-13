import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  isCompleteWaterSortBottle,
  type WaterSortBottle,
} from "@/games/water-sort/puzzle/state";

/** 1色で満杯のボトルの色。そうでなければ `null`。 */
export function getCompletedBottleColor(
  bottle: WaterSortBottle,
): number | null {
  return isCompleteWaterSortBottle(bottle) ? (bottle[0] ?? null) : null;
}

/** 注いだ結果、注ぎ先が1色で満杯になった。 */
export function isCompletedByPour(
  operation: Extract<WaterSortOperation, { type: "poured" }>,
): boolean {
  const before = operation.stateBefore[operation.destinationBottleIndex] ?? [];
  const after = operation.stateAfter[operation.destinationBottleIndex] ?? [];
  return (
    getCompletedBottleColor(before) === null &&
    getCompletedBottleColor(after) !== null
  );
}
