import { formatSlidePuzzleElapsedTime } from "@/games/slide-puzzle/ui/format-elapsed-time";

export function formatSlidePuzzleMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `${moveDelta > 0 ? "+" : ""}${moveDelta}`;
}

export function formatSlidePuzzleTimeDelta(timeDeltaMs: number): string {
  if (timeDeltaMs === 0) {
    return "±00:00";
  }

  const sign = timeDeltaMs > 0 ? "+" : "-";
  return `${sign}${formatSlidePuzzleElapsedTime(Math.abs(timeDeltaMs))}`;
}
