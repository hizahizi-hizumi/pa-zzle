/**
 * ボトルに一時的に重ねる合図。チュートリアルで、手の結果や次に押すボトルを説明文に頼らず盤面の上で示すのに使う。
 * - `sorted`: 1色で満杯にそろったことを、ボトルの外側を一瞬光らせて示す。液体の色は薄めない。
 * - `pointed`: 一言が指すそろったボトルを、一言が出ている間、`sorted` と同じ光で示し続ける。
 * - `hint`: 次に押すボトルを、出た瞬間から分かる強さで示す。
 */
export type WaterSortBottleCueKind = "sorted" | "pointed" | "hint";

/** `id` が変わると、同じボトルの同じ合図でもやり直す。 */
export type WaterSortBottleCue = {
  bottleIndex: number;
  kind: WaterSortBottleCueKind;
  id: number;
};
