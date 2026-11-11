/**
 * ボトルに一時的に重ねる合図。チュートリアルで、次にタップするボトルと手の結果を、説明文に頼らず盤面の上で示すのに使う。
 * - `hint`: 次にタップするボトルの印。
 * - `recall`: `hint` の印の線を短く濃くして戻す。印の無いボトルが押されたときに使う。
 * - `completed`: 1色そろったボトルの印。そろった瞬間に応え、そろっている間残す。
 */
export type WaterSortBottleCueKind = "hint" | "recall" | "completed";

/** `id` が変わると、同じボトルの同じ合図でもやり直す。 */
export type WaterSortBottleCue = {
  bottleIndex: number;
  kind: WaterSortBottleCueKind;
  id: number;
};
