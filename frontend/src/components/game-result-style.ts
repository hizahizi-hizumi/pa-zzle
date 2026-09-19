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
  confettiIntensity: "strong" | "light" | null;
};

const gameResultStyles: Record<GameResultLevel, GameResultStyle> = {
  perfect: {
    message: "パーフェクト！",
    scoreClassName: "text-amber-600 dark:text-amber-300",
    surfaceVariant: "perfect",
    markClassName:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    confettiIntensity: "strong",
  },
  great: {
    message: "すばらしい！",
    scoreClassName: "text-emerald-600 dark:text-emerald-300",
    surfaceVariant: "great",
    markClassName:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    confettiIntensity: "light",
  },
  good: {
    message: "ナイスプレイ！",
    scoreClassName: "text-sky-600 dark:text-sky-300",
    surfaceVariant: "good",
    markClassName:
      "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    confettiIntensity: null,
  },
  clear: {
    message: null,
    scoreClassName: "text-foreground",
    surfaceVariant: "neutral",
    markClassName: "bg-muted text-foreground",
    confettiIntensity: null,
  },
};

export function getGameResultStyle(level: GameResultLevel): GameResultStyle {
  return gameResultStyles[level];
}
