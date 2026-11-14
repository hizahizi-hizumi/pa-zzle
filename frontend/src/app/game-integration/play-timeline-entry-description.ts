import type { ZukanNumber } from "@/features/zukan/zukan-number";

export type PlayTimelineEntryDescription = {
  gameName: string;
  pictogramSvg: string;
  /** 今の区分にも当時の区分にも無ければ `null`。 */
  levelLabel: string | null;
  /** 今の問題集で引けない問題は `null`。 */
  zukanNumber: ZukanNumber | null;
  /** 今の評価規則で評価できない記録と離脱したプレイは `null`。 */
  score: number | null;
};
