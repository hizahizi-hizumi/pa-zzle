export type WaterSortExperience = "classic" | "settle" | "touch";

export const WATER_SORT_EXPERIENCES = ["classic", "settle", "touch"] as const;

export function getWaterSortTransferDurationMs(units: number): number {
  return 290 + Math.max(1, Math.min(4, units)) * 70;
}
