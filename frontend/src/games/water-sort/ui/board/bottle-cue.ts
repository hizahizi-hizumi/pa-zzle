/**
 * ボトルに一時的に重ねる合図。チュートリアルで、次にタップするボトルと手の結果を、説明文に頼らず盤面の上で示すのに使う。
 * - `hint`: 次にタップするボトルの印。
 * - `recall`: `hint` の印の線を短く濃くして戻す。印の無いボトルが押されたときに使う。
 */
export type WaterSortBottleCueKind = "hint" | "recall";

export type WaterSortBottleCue = {
  bottleIndex: number;
  kind: WaterSortBottleCueKind;
  /** 変わると、同じボトルの同じ合図でもやり直す。 */
  id: number;
};
