import type { GameResultLevel } from "@/games/result";

type GameResultStyle = {
  message: string;
  scoreClassName: string;
  panelClassName: string;
  markClassName: string;
  confettiIntensity: "strong" | "light" | null;
};

const gameResultStyles: Record<GameResultLevel, GameResultStyle> = {
  perfect: {
    message: "パーフェクト！",
    scoreClassName: "text-amber-600 dark:text-amber-300",
    panelClassName:
      "border-amber-200 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/30",
    markClassName:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    confettiIntensity: "strong",
  },
  great: {
    message: "すばらしい！",
    scoreClassName: "text-emerald-600 dark:text-emerald-300",
    panelClassName:
      "border-emerald-200 bg-emerald-50/75 dark:border-emerald-900/70 dark:bg-emerald-950/30",
    markClassName:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    confettiIntensity: "light",
  },
  good: {
    message: "ナイスプレイ！",
    scoreClassName: "text-sky-600 dark:text-sky-300",
    panelClassName:
      "border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/30",
    markClassName:
      "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    confettiIntensity: null,
  },
  clear: {
    message: "クリア！",
    scoreClassName: "text-foreground",
    panelClassName: "border-border bg-muted/40",
    markClassName: "bg-muted text-foreground",
    confettiIntensity: null,
  },
};

export function getGameResultStyle(level: GameResultLevel): GameResultStyle {
  return gameResultStyles[level];
}
