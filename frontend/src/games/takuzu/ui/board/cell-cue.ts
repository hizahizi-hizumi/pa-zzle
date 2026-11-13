/**
 * マスに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `fitted`: 手順のマスに正しいタイルを置いたことに、その瞬間だけ控えめに応える。
 * - `hint`: 次に置くマスの印。
 * - `recall`: `hint` の印の線を短く濃くして戻す。印の無いマスを押されたときに使う。
 */
export type TakuzuCellCueKind = "fitted" | "hint" | "recall";

export type TakuzuCellCue = {
  cellIndex: number;
  kind: TakuzuCellCueKind;
  /** `id` が変わると、同じマスの同じ合図でもやり直す。 */
  id: number;
};
