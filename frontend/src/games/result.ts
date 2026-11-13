export const gameResultLevelsAscending = [
  "clear",
  "good",
  "great",
  "perfect",
] as const;

export type GameResultLevel = (typeof gameResultLevelsAscending)[number];

export function getGameResultLevel(score: number): GameResultLevel {
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

export function isHigherGameResultLevel(
  level: GameResultLevel,
  other: GameResultLevel,
): boolean {
  return (
    gameResultLevelsAscending.indexOf(level) >
    gameResultLevelsAscending.indexOf(other)
  );
}
