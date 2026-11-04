import type { ZukanNumber } from "@/zukan/zukan-number";

/** 記録画面の時間の流れの1件に示す、どのゲームのどの問題をどう遊んだか。 */
export type PlayTimelineEntryDescription = {
  gameName: string;
  pictogramSvg: string;
  /** 遊んだレベル。今の区分にも当時の区分にも無ければ `null`。 */
  levelLabel: string | null;
  /** 図鑑の番号。今の問題集で引けない問題は `null`。 */
  zukanNumber: ZukanNumber | null;
  /** クリアしたプレイの評価点。今の評価規則で評価できない記録と離脱したプレイは `null`。 */
  score: number | null;
};
