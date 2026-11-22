import type { WaterSortState } from "@/games/water-sort/puzzle/state";

/** 装置の起動。全部の管がそろってから、結果へ移るまで。 */
export const FINALE_DURATION_MS = 2300;
/** 起動の光が管を順に走る区間。 */
const IGNITION_START_MS = 160;
const IGNITION_SPAN_MS = 620;
/** 走り終えた光が、制御室の全体へ広がる区間。 */
export const FINALE_SURGE_START_MS = 820;
export const FINALE_SURGE_DURATION_MS = 900;

export type CellIgnition = {
  bottleIndex: number;
  delayMs: number;
  /** 空の管は光が通り過ぎるだけで、灯らない。 */
  colorIndex: number | null;
};

/** 起動の光が、盤面の並び順に管を走る時刻。 */
export function getCellIgnitions(
  state: WaterSortState,
): readonly CellIgnition[] {
  const step = getIgnitionStepMs(state);
  return state.map((bottle, bottleIndex) => ({
    bottleIndex,
    delayMs: IGNITION_START_MS + step * bottleIndex,
    colorIndex: bottle[0] ?? null,
  }));
}

export function getIgnitionStepMs(state: WaterSortState): number {
  return IGNITION_SPAN_MS / Math.max(1, state.length - 1);
}
