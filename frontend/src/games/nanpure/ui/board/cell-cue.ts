/**
 * マスに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `fitted`: 手順のマスに解の数字を入れたことに、その瞬間だけ控えめに応える。
 * - `hint`: 次に数字を入れるマスの印。
 * - `recall`: `hint` の印の線を短く濃くして戻す。印の無いマスを押されたときに使う。
 *
 * 違う数字と重なった数字は、本番と同じミスと重なりの色だけで示す。
 */
export type NanpureCellCueKind = "fitted" | "hint" | "recall";

/** `id` が変わると、同じマスの同じ合図でもやり直す。 */
export type NanpureCellCue = {
  cellIndex: number;
  kind: NanpureCellCueKind;
  id: number;
};
