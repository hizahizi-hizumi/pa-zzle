import type { HitofudePuzzleDirection } from "@/games/hitofude-puzzle/puzzle/board";

const directionByArrowKey: Readonly<Record<string, HitofudePuzzleDirection>> = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
};

export function findArrowKeyDirection(
  key: string,
): HitofudePuzzleDirection | null {
  return directionByArrowKey[key] ?? null;
}
