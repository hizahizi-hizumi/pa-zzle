import { formatElapsedTime } from "@/lib/format-elapsed-time";

export function formatElapsedTimeDelta(timeDeltaMs: number): string {
  if (timeDeltaMs === 0) {
    return "±00:00";
  }

  const sign = timeDeltaMs > 0 ? "+" : "-";
  return `${sign}${formatElapsedTime(Math.abs(timeDeltaMs))}`;
}

export function formatCountDelta(countDelta: number): string {
  return countDelta === 0 ? "±0" : `${countDelta > 0 ? "+" : ""}${countDelta}`;
}
