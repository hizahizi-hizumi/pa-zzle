/**
 * ボトルに一時的に重ねる合図。チュートリアルで、手の結果や次に押すボトルを説明文に頼らず盤面の上で示すのに使う。同じボトルに重ねてよい。
 * - `sorted`: 1色で満杯にそろったことを、ボトルの外側を一瞬光らせて示す。液体の色は薄めない。
 * - `sorted-held`: `sorted` と同じ光を、出している間は消さずに示し続ける。完成を見せている間に使う。
 * - `hint`: 次に押すボトルを、出た瞬間から分かる強さで示す。
 * - `rejected`: 押したボトルを受け付けなかったことを、動かさずにボトルの縁を一瞬警告の色にして示す。揺れを見せない動きを減らす設定でも伝わる。
 */
export type WaterSortBottleCueKind =
  | "sorted"
  | "sorted-held"
  | "hint"
  | "rejected";

/** `id` が変わると、同じボトルの同じ合図でもやり直す。 */
export type WaterSortBottleCue = {
  bottleIndex: number;
  kind: WaterSortBottleCueKind;
  id: number;
};
