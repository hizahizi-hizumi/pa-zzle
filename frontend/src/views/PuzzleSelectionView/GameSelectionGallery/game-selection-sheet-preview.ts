/** 額の中に敷く、そのゲームの台紙の絵。全部の行を `columnCount` 列で描いたもの。額の中で縦に送って見られる。 */
export type GameSelectionSheetPreview = {
  imageUrl: string;
  /** 同じ並びの、ピースの間の溝だけの絵。ピクトグラムの上に重ねる。 */
  groovesImageUrl: string;
  columnCount: number;
  rowCount: number;
  /** 初めに見せる行。台紙の上から数えた 0 始まりの位置。 */
  firstRow: number;
  /** ゲームのホームが台紙を見せ始められる、最後の行。 */
  lastOpenableRow: number;
  /** 台紙のゲームの ID。結果から運んだピースが、同じゲームの台紙のピースかを見分けるのに使う。 */
  gameId: string;
  /** 台紙の全問の数。 */
  problemCount: number;
  /** 台紙の難易度。結果から運んだピースが、同じ台紙のピースかを見分けるのに使う。 */
  difficulty: string;
};
