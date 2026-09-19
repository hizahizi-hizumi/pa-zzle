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
