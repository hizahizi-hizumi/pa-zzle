import type { ScoreItem } from "@/games/score";

export const PLAY_OPERATION_LABELS = {
  undo: "待った",
  restart: "盤面を戻す",
  replay: "リセット",
  startNewProblem: "別の問題",
} as const;

export type PlayOperation = keyof typeof PLAY_OPERATION_LABELS;

export const SCORE_ITEM_LABELS = {
  accuracy: "正確さ",
  efficiency: "効率",
  speed: "速さ",
  stability: "安定性",
} as const satisfies Record<ScoreItem, string>;
