import type { GameResultLevel } from "@/games/core/result";

export function calculateWaterSortPlayScore(
  moveCount: number,
  optimalMoveCount: number,
): number {
  if (optimalMoveCount <= 0) {
    return 100;
  }

  const effectiveMoveCount = Math.max(moveCount, optimalMoveCount);
  return Math.round((optimalMoveCount / effectiveMoveCount) * 100);
}

export function getWaterSortGameResultLevel(score: number): GameResultLevel {
  if (score >= 100) {
    return "perfect";
  }
  if (score >= 90) {
    return "great";
  }
  if (score >= 80) {
    return "good";
  }
  return "clear";
}
