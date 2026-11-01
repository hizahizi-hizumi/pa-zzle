import type { SlidePuzzleTile } from "@/games/slide-puzzle/puzzle/state";

/**
 * タイルに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `landed`: スライドしたタイルが自分の場所に収まったことを、一瞬光らせて示す。
 * - `hint`: 次にタップするタイルを、控えめに示す。
 */
export type SlidePuzzleTileCueKind = "landed" | "hint";

/** `id` が変わると、同じタイルの同じ合図でもやり直す。 */
export type SlidePuzzleTileCue = {
  tile: SlidePuzzleTile;
  kind: SlidePuzzleTileCueKind;
  id: number;
};
