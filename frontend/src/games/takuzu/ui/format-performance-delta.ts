import { formatTakuzuElapsedTime } from "@/games/takuzu/ui/format-elapsed-time";

/** 基準時間との差。基準より速ければ `-`、遅ければ `+` を付ける。 */
export function formatTakuzuTimeDelta(timeDeltaMs: number): string {
  if (timeDeltaMs === 0) {
    return "±00:00";
  }

  const sign = timeDeltaMs > 0 ? "+" : "-";
  return `${sign}${formatTakuzuElapsedTime(Math.abs(timeDeltaMs))}`;
}
