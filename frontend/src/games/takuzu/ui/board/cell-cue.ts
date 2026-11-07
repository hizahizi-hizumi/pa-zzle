/**
 * マスに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `reason`: 置いたタイルが決まった理由のマスを、一瞬光らせる。
 * - `hint`: 手が止まったときに、決まるマスを控えめに示す。
 * - `recall`: `hint` と同じ印を、光らせ直して目を向けさせる。印の無いマスを押されたときに使う。
 *
 * ルールに合わないタイルは本番と同じ違反の印で示し、揺らさない。揺れは本番と同じく、固定マスを押したときだけにする。
 */
export type TakuzuCellCueKind = "reason" | "hint" | "recall";

/** `id` が変わると、同じマスの同じ合図でもやり直す。 */
export type TakuzuCellCue = {
  cellIndex: number;
  kind: TakuzuCellCueKind;
  id: number;
};
