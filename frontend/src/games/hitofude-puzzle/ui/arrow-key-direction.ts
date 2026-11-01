import type { HitofudePuzzleDirection } from "@/games/hitofude-puzzle/puzzle/board";

const directionByArrowKey: Readonly<Record<string, HitofudePuzzleDirection>> = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
};

/** 矢印キーが指す盤面の向き。矢印キーでなければ `null`。 */
export function findArrowKeyDirection(
  key: string,
): HitofudePuzzleDirection | null {
  return directionByArrowKey[key] ?? null;
}
