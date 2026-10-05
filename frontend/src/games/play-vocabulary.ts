/**
 * プレイ中の操作の呼び名。メニュー、結果画面、採点基準、記録表示で同じ語を使う。
 * - `undo`: 直前の操作を1つ取り消す。
 * - `restart`: 同じプレイのまま盤面を初期配置へ戻す。
 * - `replay`: 同じ問題を新しいプレイとして始める。
 * - `startNewProblem`: 同じ難易度の別の問題を始める。
 */
export const PLAY_OPERATION_LABELS = {
  undo: "待った",
  restart: "盤面を戻す",
  replay: "リセット",
  startNewProblem: "別の問題",
} as const;

export type PlayOperation = keyof typeof PLAY_OPERATION_LABELS;
