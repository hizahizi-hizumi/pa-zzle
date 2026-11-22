import type { ZukanSheetPreview } from "@/features/zukan/ui/zukan-sheet-preview";

/** 額の中に敷く、そのゲームの台紙の絵の元。全部の行を `columnCount` 列で描く。額の中で縦に送って見られる。 */
export type GameSelectionSheetPreview = ZukanSheetPreview & {
  /** 台紙のゲームの ID。結果から運んだピースが、同じゲームの台紙のピースかを見分けるのに使う。 */
  gameId: string;
  /** 台紙の全問の数。 */
  problemCount: number;
  /** 台紙の難易度。結果から運んだピースが、同じ台紙のピースかを見分けるのに使う。 */
  difficulty: string;
};
