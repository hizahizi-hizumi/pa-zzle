import type { SlidePuzzleTile } from "@/games/slide-puzzle/puzzle/state";

/**
 * タイルに一時的に重ねる合図。チュートリアルで、手の結果を説明文に頼らず盤面の上で返すのに使う。
 * - `landed`: スライドしたタイルが自分の場所に収まったことを、一瞬光らせて示す。
 * - `hint`: 次にタップするタイルを、出た瞬間から分かる強さで示す。
 * - `reminder`: `hint` の印を付けたまま、タイルを光らせ直して目を向けさせる。印の無いタイルが押されたときに使う。
 *   光は色の濃さだけで返し、動きを減らす設定でも同じに見せる。
 */
export type SlidePuzzleTileCueKind = "landed" | "hint" | "reminder";

/** `id` が変わると、同じタイルの同じ合図でもやり直す。 */
export type SlidePuzzleTileCue = {
  tile: SlidePuzzleTile;
  kind: SlidePuzzleTileCueKind;
  id: number;
};
