/**
 * 試験管の形。ボトルの箱（幅:高さ = 0.36）を、幅 36・高さ 100 の座標で描く。
 * 4段の層をどれも同じ高さで数えられるよう、底の丸みは浅い楕円にして、下の段だけが大きく見えないようにする。
 */
export const TUBE_VIEW_WIDTH = 36;
export const TUBE_VIEW_HEIGHT = 100;
export const TUBE_VIEW_BOX = `0 0 ${TUBE_VIEW_WIDTH} ${TUBE_VIEW_HEIGHT}`;

/** 管の内側（液の入る所）。 */
export const TUBE_INNER = {
  left: 3,
  right: 33,
  /** 4段目の上端。これより上は首の空き（栓と試験管ばさみが来る所）。 */
  slotTop: 12.5,
  bottom: 96.6,
  /** 底の丸みの縦の深さ。 */
  bottomDepth: 7,
} as const;

/** 管の外側。 */
export const TUBE_OUTER = {
  left: 1.6,
  right: 34.4,
  bottom: 98,
} as const;

/** 管の壁の厚さ。 */
export const TUBE_WALL_THICKNESS = TUBE_INNER.left - TUBE_OUTER.left;

/** 口の縁。管より少し外へ張り出す帯。 */
export const TUBE_RIM = {
  left: 0.4,
  right: 35.6,
  top: 0.6,
  bottom: 4.4,
} as const;

/** そろった試験管の口に差すゴム栓の、口から上に出た頭の上端。 */
export const STOPPER_HEAD_TOP = -4.4;

/** 底の丸みが始まる高さ。内側と外側の丸みは、同じ高さから始まる。 */
export const TUBE_BOTTOM_ARC_TOP = TUBE_INNER.bottom - TUBE_INNER.bottomDepth;

/** 4段のうち1段の高さ。 */
export const TUBE_SLOT_HEIGHT = (TUBE_INNER.bottom - TUBE_INNER.slotTop) / 4;

/** 液の入れ物を、箱に対する割合で置く。 */
export const LIQUID_BOX_STYLE = {
  left: `${(TUBE_INNER.left / TUBE_VIEW_WIDTH) * 100}%`,
  right: `${((TUBE_VIEW_WIDTH - TUBE_INNER.right) / TUBE_VIEW_WIDTH) * 100}%`,
  top: `${TUBE_INNER.slotTop}%`,
  bottom: `${TUBE_VIEW_HEIGHT - TUBE_INNER.bottom}%`,
  borderRadius: `0 0 50% 50% / 0 0 ${(TUBE_INNER.bottomDepth / (TUBE_INNER.bottom - TUBE_INNER.slotTop)) * 100}% ${(TUBE_INNER.bottomDepth / (TUBE_INNER.bottom - TUBE_INNER.slotTop)) * 100}%`,
} as const;

/** 液面の高さ（箱の上端からの割合、0〜1）。`filledSlots` は満たした段の数。 */
export function getSurfaceRatio(filledSlots: number): number {
  return (
    (TUBE_INNER.bottom - TUBE_SLOT_HEIGHT * filledSlots) / TUBE_VIEW_HEIGHT
  );
}

/** 口の高さ（箱の上端からの割合）。傾けた液は、ここまで寄ってからあふれる。 */
export const TUBE_MOUTH_RATIO = (TUBE_RIM.top + TUBE_RIM.bottom) / 2 / 100;

/** 試験管の外形を囲む点。口の縁の両端、底の丸みの始まりの両端、底。 */
export const TUBE_OUTLINE_POINTS = [
  [TUBE_RIM.left, TUBE_RIM.top],
  [TUBE_RIM.right, TUBE_RIM.top],
  [TUBE_OUTER.left, TUBE_BOTTOM_ARC_TOP],
  [TUBE_OUTER.right, TUBE_BOTTOM_ARC_TOP],
  [TUBE_VIEW_WIDTH / 2, TUBE_OUTER.bottom],
] as const;

/** 首を挟む試験管ばさみの口の上端と下端。口の縁のすぐ下から、4段目の上端の手前まで。 */
export const CLAMP_JAW = {
  top: TUBE_RIM.bottom + 0.6,
  bottom: TUBE_INNER.slotTop - 1.6,
} as const;

/**
 * 右に柄を出した試験管ばさみの、柄の先の2つの角（下の角、上の角）。試験管ばさみは柄をこの2点へ描き、
 * 注ぐ動きは、この2点で見出しや画面の端にはみ出さないかを確かめる。
 */
export const CLAMP_HANDLE_TIP_POINTS = [
  [50.4, 2.4],
  [48.8, -0.8],
] as const;
