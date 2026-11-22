/** 注ぐ所作の層の重なり順。プレイ画面の中で、盤面より上に、注ぎ先・スプーン・柄を伝う液・注ぎ元の順で重ねる。 */
export const BAR_POUR_LAYER_ORDER = {
  destination: 1,
  spoon: 2,
  stream: 3,
  source: 4,
} as const;
