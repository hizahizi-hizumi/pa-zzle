import { formatElapsedTime } from "@/lib/format-elapsed-time";

/** 基準時間との差。基準より遅ければ `+`、速ければ `-` を付け、一致すれば `±00:00` とする。 */
export function formatElapsedTimeDelta(timeDeltaMs: number): string {
  if (timeDeltaMs === 0) {
    return "±00:00";
  }

  const sign = timeDeltaMs > 0 ? "+" : "-";
  return `${sign}${formatElapsedTime(Math.abs(timeDeltaMs))}`;
}

/** 手数などの回数の差。多ければ `+`、少なければ `-` を付け、一致すれば `±0` とする。 */
export function formatCountDelta(countDelta: number): string {
  return countDelta === 0 ? "±0" : `${countDelta > 0 ? "+" : ""}${countDelta}`;
}
