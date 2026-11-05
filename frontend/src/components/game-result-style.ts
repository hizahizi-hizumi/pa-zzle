import type { GameResultLevel } from "@/games/result";

export type GameResultSurfaceVariant =
  | "neutral"
  | "good"
  | "great"
  | "perfect"
  | "personalBest";

type GameResultStyle = {
  message: string | null;
  scoreClassName: string;
  surfaceVariant: GameResultSurfaceVariant;
  markClassName: string;
  /**
   * 評価段階を小さな面の塗りだけで示すときの色。段階のある色はスコアの文字と同じにし、`clear` は前景より弱い無彩色にする。
   * 文字色として与え、面は `currentColor` で塗る（`bg-current`、SVG の `fill="currentColor"`）。
   */
  fillColorClassName: string;
  confettiIntensity: "strong" | "light" | null;
};

const gameResultStyles: Record<GameResultLevel, GameResultStyle> = {
  perfect: {
    message: "パーフェクト！",
    scoreClassName: "text-result-perfect",
    surfaceVariant: "perfect",
    markClassName: "bg-result-perfect-subtle text-result-perfect-strong",
    fillColorClassName: "text-result-perfect",
    confettiIntensity: "strong",
  },
  great: {
    message: "すばらしい！",
    scoreClassName: "text-result-great",
    surfaceVariant: "great",
    markClassName: "bg-result-great-subtle text-result-great-strong",
    fillColorClassName: "text-result-great",
    confettiIntensity: "light",
  },
  good: {
    message: "ナイスプレイ！",
    scoreClassName: "text-result-good",
    surfaceVariant: "good",
    markClassName: "bg-result-good-subtle text-result-good-strong",
    fillColorClassName: "text-result-good",
    confettiIntensity: null,
  },
  clear: {
    message: null,
    scoreClassName: "text-foreground",
    surfaceVariant: "neutral",
    markClassName: "bg-muted text-foreground",
    fillColorClassName: "text-muted-foreground",
    confettiIntensity: null,
  },
};

export function getGameResultStyle(level: GameResultLevel): GameResultStyle {
  return gameResultStyles[level];
}
