import { formatWaterSortElapsedTime } from "./format-elapsed-time";

export function formatWaterSortMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `${moveDelta > 0 ? "+" : ""}${moveDelta}`;
}

export function formatWaterSortTimeDelta(timeDeltaMs: number): string {
  if (timeDeltaMs === 0) {
    return "±00:00";
  }

  const sign = timeDeltaMs > 0 ? "+" : "-";
  return `${sign}${formatWaterSortElapsedTime(Math.abs(timeDeltaMs))}`;
}
