/**
 * マスに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `extended`: 手順のマスまで道を延ばしたことに、その瞬間だけ控えめに応える。
 * - `hint`: 次に道を延ばす・戻すマスの印。
 * - `recall`: `hint` の印の線を短く濃くして戻す。印の無い所へ延ばそうとしたときに使う。
 */
export type HitofudePuzzleCellCueKind = "extended" | "hint" | "recall";

/** `id` が変わると、同じマスの同じ合図でもやり直す。 */
export type HitofudePuzzleCellCue = {
  cell: number;
  kind: HitofudePuzzleCellCueKind;
  id: number;
};
