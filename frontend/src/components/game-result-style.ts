import type { GameResultLevel } from "@/games/result";

export type GameResultSurfaceVariant =
  | "neutral"
  | "good"
  | "great"
  | "perfect"
  | "personalBest";

type GameResultStyle = {
  message: string;
  messageClassName: string;
  scoreFigureClassName: string;
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
    messageClassName: "text-reward text-amber-600 dark:text-amber-300",
    scoreFigureClassName:
      "text-screen-title font-bold text-amber-600 dark:text-amber-300",
    scoreClassName: "text-amber-600 dark:text-amber-300",
    surfaceVariant: "perfect",
    markClassName:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    fillColorClassName: "text-amber-600 dark:text-amber-300",
    confettiIntensity: "strong",
  },
  great: {
    message: "すばらしい！",
    messageClassName: "text-reward text-emerald-600 dark:text-emerald-300",
    scoreFigureClassName:
      "text-screen-title font-bold text-emerald-600 dark:text-emerald-300",
    scoreClassName: "text-emerald-600 dark:text-emerald-300",
    surfaceVariant: "great",
    markClassName:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    fillColorClassName: "text-emerald-600 dark:text-emerald-300",
    confettiIntensity: "light",
  },
  good: {
    message: "ナイスプレイ！",
    messageClassName: "text-reward text-sky-600 dark:text-sky-300",
    scoreFigureClassName:
      "text-screen-title font-bold text-sky-600 dark:text-sky-300",
    scoreClassName: "text-sky-600 dark:text-sky-300",
    surfaceVariant: "good",
    markClassName:
      "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    fillColorClassName: "text-sky-600 dark:text-sky-300",
    confettiIntensity: null,
  },
  clear: {
    message: "クリア",
    messageClassName: "text-screen-title text-foreground/85",
    scoreFigureClassName: "text-heading font-semibold text-foreground/75",
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
