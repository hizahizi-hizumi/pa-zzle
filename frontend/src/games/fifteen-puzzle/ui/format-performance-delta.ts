import { formatFifteenPuzzleElapsedTime } from "@/games/fifteen-puzzle/ui/format-elapsed-time";

export function formatFifteenPuzzleMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `${moveDelta > 0 ? "+" : ""}${moveDelta}`;
}

export function formatFifteenPuzzleTimeDelta(timeDeltaMs: number): string {
  if (timeDeltaMs === 0) {
    return "±00:00";
  }

  const sign = timeDeltaMs > 0 ? "+" : "-";
  return `${sign}${formatFifteenPuzzleElapsedTime(Math.abs(timeDeltaMs))}`;
}
