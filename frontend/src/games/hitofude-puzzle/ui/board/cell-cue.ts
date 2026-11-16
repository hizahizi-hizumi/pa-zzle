/**
 * マスに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `extended`: 手順のマスまで道を延ばしたことに、その瞬間だけ控えめに応える。`id` が変わると、同じマスでもやり直す。
 * - `mark`: 次に道を延ばす・戻すマスの印。`recallId` は印の無い所へ延ばそうとするたびに変え、変わると印の線を短く濃くして戻す。
 *   `pointed` なら、押すしぐさをする指でも指す。
 */
export type HitofudePuzzleCellCue =
  | { cell: number; kind: "extended"; id: number }
  | { cell: number; kind: "mark"; recallId: number | null; pointed: boolean };
