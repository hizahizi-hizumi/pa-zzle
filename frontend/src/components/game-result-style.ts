import type { GameResultLevel } from "@/games/result";

type GameResultStyle = {
  message: string | null;
  scoreClassName: string;
  markClassName: string;
  /**
   * 図鑑などの小さな面に使う評価段階そのものの色。
   * 文字は同系色の濃いトーンを使い、薄い clear でも読めるようにする。
   */
  fillColorClassName: string;
};

const gameResultStyles: Record<GameResultLevel, GameResultStyle> = {
  perfect: {
    message: "パーフェクト！",
    scoreClassName: "text-grade-perfect-ink",
    markClassName: "bg-grade-perfect/20 text-grade-perfect-ink",
    fillColorClassName: "text-grade-perfect",
  },
  great: {
    message: "すばらしい！",
    scoreClassName: "text-grade-great-ink",
    markClassName: "bg-grade-great/20 text-grade-great-ink",
    fillColorClassName: "text-grade-great",
  },
  good: {
    message: "ナイスプレイ！",
    scoreClassName: "text-grade-good-ink",
    markClassName: "bg-grade-good/20 text-grade-good-ink",
    fillColorClassName: "text-grade-good",
  },
  clear: {
    message: null,
    scoreClassName: "text-grade-clear-ink",
    markClassName: "bg-grade-clear/20 text-grade-clear-ink",
    fillColorClassName: "text-grade-clear",
  },
};

export function getGameResultStyle(level: GameResultLevel): GameResultStyle {
  return gameResultStyles[level];
}
