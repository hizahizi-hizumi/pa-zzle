export type GameResultLevel = "clear" | "good" | "great" | "perfect";

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
