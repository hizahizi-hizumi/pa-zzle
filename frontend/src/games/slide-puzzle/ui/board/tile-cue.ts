import type { SlidePuzzleTile } from "@/games/slide-puzzle/puzzle/state";

/**
 * タイルに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `landed`: スライドしたタイルが自分の場所に収まったことに、その瞬間だけ控えめに応える。
 * - `hint`: 次にタップするタイルの印。
 * - `recall`: `hint` の印の線を短く濃くして戻す。印の無いタイルが押されたときに使う。
 */
export type SlidePuzzleTileCueKind = "landed" | "hint" | "recall";

/** `id` が変わると、同じタイルの同じ合図でもやり直す。 */
export type SlidePuzzleTileCue = {
  tile: SlidePuzzleTile;
  kind: SlidePuzzleTileCueKind;
  id: number;
};
