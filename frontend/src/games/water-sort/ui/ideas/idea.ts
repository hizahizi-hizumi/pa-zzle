/**
 * プレイ画面の世界（質感）の案を見比べるための試作。PO が方向を選ぶまでの間だけ置く。
 * 本質: 限られた器のあいだで注ぐ順を読み、混ざり合った色水を、同じ色どうしひとつの水に溶け合わせていく。
 */
export const WATER_SORT_IDEAS = [
  { id: "current", label: "今の画面" },
  { id: "lab", label: "1 理科室の実験" },
  { id: "alchemy", label: "2 錬金術師の工房" },
  { id: "kitchen", label: "3 台所の仕込み" },
  { id: "future", label: "4 未来の研究施設" },
  { id: "summer", label: "5 夏の色水遊び" },
  { id: "bar", label: "6 夜のバーカウンター" },
] as const;

export type WaterSortIdeaId = (typeof WATER_SORT_IDEAS)[number]["id"];

export function isWaterSortIdeaId(value: unknown): value is WaterSortIdeaId {
  return WATER_SORT_IDEAS.some(({ id }) => id === value);
}
