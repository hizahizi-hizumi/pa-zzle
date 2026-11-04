/**
 * マスに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `fitted`: 手順のマスに正しいタイルを置いたことを、そのマスを一瞬光らせて示す。
 * - `reason`: 置いたタイルが決まった理由のマスを、一瞬光らせる。
 * - `hint`: 次に置くマスを、出た瞬間から分かる強さで示す。
 * - `recall`: `hint` と同じ印を、光らせ直して目を向けさせる。印の無いマスを押されたときに使う。
 *
 * ルールに合わないタイルは本番と同じ違反の印で示し、揺らさない。揺れは本番と同じく、固定マスを押したときだけにする。
 */
export type TakuzuCellCueKind = "fitted" | "reason" | "hint" | "recall";

/** `id` が変わると、同じマスの同じ合図でもやり直す。 */
export type TakuzuCellCue = {
  cellIndex: number;
  kind: TakuzuCellCueKind;
  id: number;
};
