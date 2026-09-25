import { formatElapsedTime } from "@/games/minesweeper/ui/format-elapsed-time";

export function formatMinesweeperTimeDelta(timeDeltaMs: number): string {
  if (timeDeltaMs === 0) {
    return "±00:00";
  }

  const sign = timeDeltaMs > 0 ? "+" : "-";
  return `${sign}${formatElapsedTime(Math.abs(timeDeltaMs))}`;
}
