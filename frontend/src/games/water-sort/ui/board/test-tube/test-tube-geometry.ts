/**
 * 試験管の形。ボトルの箱（幅:高さ = 0.36）を、幅 36・高さ 100 の座標で描く。
 * 4段の層をどれも同じ高さで数えられるよう、底の丸みは浅い楕円にして、下の段だけが大きく見えないようにする。
 */
export const TUBE_VIEW_BOX = "0 0 36 100";

const VIEW_WIDTH = 36;
const VIEW_HEIGHT = 100;

/** 管の内側（液の入る所）。 */
export const TUBE_INNER = {
  left: 4.9,
  right: 31.1,
  /** 4段目の上端。これより上は首の空き（栓・試験管ばさみ・試験管立ての穴が来る所）。 */
  slotTop: 26,
  bottom: 95.6,
  /** 底の丸みの縦の深さ。 */
  bottomDepth: 7.4,
} as const;

/** 液の入れ物を、箱に対する割合で置く。 */
export const LIQUID_BOX_STYLE = {
  left: `${(TUBE_INNER.left / VIEW_WIDTH) * 100}%`,
  right: `${((VIEW_WIDTH - TUBE_INNER.right) / VIEW_WIDTH) * 100}%`,
  top: `${TUBE_INNER.slotTop}%`,
  bottom: `${VIEW_HEIGHT - TUBE_INNER.bottom}%`,
  borderRadius: `0 0 50% 50% / 0 0 ${(TUBE_INNER.bottomDepth / (TUBE_INNER.bottom - TUBE_INNER.slotTop)) * 100}% ${(TUBE_INNER.bottomDepth / (TUBE_INNER.bottom - TUBE_INNER.slotTop)) * 100}%`,
} as const;

/** 液面の高さ（箱の上端からの割合、0〜1）。`filledSlots` は満たした段の数。 */
export function getSurfaceRatio(filledSlots: number): number {
  const slotHeight = (TUBE_INNER.bottom - TUBE_INNER.slotTop) / 4;
  return (TUBE_INNER.bottom - slotHeight * filledSlots) / VIEW_HEIGHT;
}

/** 口の縁の高さ（箱の上端からの割合）。 */
export const TUBE_MOUTH_RATIO = 0.05;

/**
 * 右に柄を出した試験管ばさみの、柄の先の2つの角（下の角、上の角）。試験管ばさみは柄をこの2点へ描き、
 * 注ぐ動きは、この2点で見出しや画面の端にはみ出さないかを確かめる。
 */
export const CLAMP_HANDLE_TIP_POINTS = [
  [57.6, 6],
  [55.6, 1.4],
] as const;
