/** 評価段階を、低い段階から高い段階の順に並べたもの。 */
export const gameResultLevels = ["clear", "good", "great", "perfect"] as const;

export type GameResultLevel = (typeof gameResultLevels)[number];

/** 100点満点の評価点を、プレイの出来に応じた称賛の強さへ変換する。 */
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

/** `level` が `other` より高い評価段階か。 */
export function isHigherGameResultLevel(
  level: GameResultLevel,
  other: GameResultLevel,
): boolean {
  return gameResultLevels.indexOf(level) > gameResultLevels.indexOf(other);
}
