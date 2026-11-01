/**
 * ボトルに一時的に重ねる合図。チュートリアルで、次にタップするボトルを説明文に頼らず盤面の上で示すのに使う。
 * - `hint`: 次にタップするボトルを、出た瞬間から分かる強さで示す。
 */
export type WaterSortBottleCueKind = "hint";

/** `id` が変わると、同じボトルの同じ合図でもやり直す。 */
export type WaterSortBottleCue = {
  bottleIndex: number;
  kind: WaterSortBottleCueKind;
  id: number;
};
