/**
 * 駒に一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `mark`: 次に動かす駒の印。`recallId` は印の無い駒を触られるたびに変え、印の線を短く濃くして戻す。触られていなければ `null`。
 * - `acknowledgement`: 手順どおりに動かし終えたことに、その瞬間だけ控えめに応える。`id` が変わるとやり直す。
 */
export type HakoiriMusumePieceCue =
  | { pieceIndex: number; kind: "mark"; recallId: number | null }
  | { pieceIndex: number; kind: "acknowledgement"; id: number };
