/**
 * ボトルに一時的に重ねる合図。チュートリアルで、次にタップするボトルを説明文に頼らず盤面の上で示すのに使う。
 * - `hint`: 次にタップするボトルを、出た瞬間から分かる強さで示す。
 * - `hint-again`: 印の無いボトルを押されたときに、印を少しの間だけ強めて光らせ直し、印へ目を向けさせる。
 *   ルールに当たったと受け取られないよう、通らない操作の揺れや赤は使わない。動きを減らす設定でも、点線が実線になり外側が光ることで分かる。
 */
export type WaterSortBottleCueKind = "hint" | "hint-again";

/** `id` が変わると、同じボトルの同じ合図でもやり直す。 */
export type WaterSortBottleCue = {
  bottleIndex: number;
  kind: WaterSortBottleCueKind;
  id: number;
};
