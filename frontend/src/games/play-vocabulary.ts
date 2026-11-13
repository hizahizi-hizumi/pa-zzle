import type { ScoreItem } from "@/games/score";

/**
 * プレイ中の操作の呼び名を、文節の切れ目に `/` を入れて書いたもの。狭い所で文節の間でだけ行を分けて描くときに使う
 * （遊び方の図に添える操作の名前など）。
 * - `undo`: 直前の操作を1つ取り消す。
 * - `restart`: 同じプレイのまま盤面を初期配置へ戻す。
 * - `replay`: 同じ問題を新しいプレイとして始める。
 * - `startNewProblem`: 同じ難易度の別の問題を始める。
 */
export const PLAY_OPERATION_PHRASES = {
  undo: "待った",
  restart: "盤面を/戻す",
  replay: "リセット",
  startNewProblem: "別の/問題",
} as const;

export type PlayOperation = keyof typeof PLAY_OPERATION_PHRASES;

/** プレイ中の操作の呼び名。メニュー、結果画面、採点基準、記録表示で同じ語を使う。文節の区切りを除いた `PLAY_OPERATION_PHRASES`。 */
export const PLAY_OPERATION_LABELS = Object.fromEntries(
  Object.entries(PLAY_OPERATION_PHRASES).map(([operation, phrases]) => [
    operation,
    phrases.replaceAll("/", ""),
  ]),
) as Record<PlayOperation, string>;

export const SCORE_ITEM_LABELS = {
  accuracy: "正確さ",
  efficiency: "効率",
  speed: "速さ",
  stability: "安定性",
} as const satisfies Record<ScoreItem, string>;
