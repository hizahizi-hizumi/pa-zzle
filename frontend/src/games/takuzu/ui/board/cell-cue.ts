/**
 * マスに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `reason`: 置いたタイルが決まった理由のマスを、一瞬光らせる。
 * - `hint`: 手が止まったときに、決まるマスを控えめに示す。
 * - `rejected`: ルールに合わないタイルを、小さく揺らす。
 */
export type TakuzuCellCueKind = "reason" | "hint" | "rejected";

/** `id` が変わると、同じマスの同じ合図でもやり直す。 */
export type TakuzuCellCue = {
  cellIndex: number;
  kind: TakuzuCellCueKind;
  id: number;
};
