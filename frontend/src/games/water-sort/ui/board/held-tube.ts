import {
  CLAMP_HANDLE_TIP_POINTS,
  TUBE_RIM,
  TUBE_VIEW_HEIGHT,
  TUBE_VIEW_WIDTH,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

/** 注ぎ元に選んだ試験管を持ち上げる高さ（px）。 */
export const HELD_TUBE_LIFT_PX = 20;
/** 持った試験管を、試験管ばさみの所を中心に左へ傾ける角度（度）と、その中心（試験管の箱に対する割合）。 */
export const HELD_TUBE_TILT_DEG = 3;
export const HELD_TUBE_TILT_ORIGIN = { x: 0.5, y: 0.08 } as const;

/** 持った試験管で、いちばん上へ出る所の候補。口の縁の両端と、左右どちらに出した柄の先。 */
const HELD_TUBE_TOP_POINTS = [
  [TUBE_RIM.left, TUBE_RIM.top],
  [TUBE_RIM.right, TUBE_RIM.top],
  ...CLAMP_HANDLE_TIP_POINTS,
  ...CLAMP_HANDLE_TIP_POINTS.map(([x, y]) => [TUBE_VIEW_WIDTH - x, y] as const),
] as const;

/** 持った試験管の口の縁と試験管ばさみの柄が、置かれている試験管の箱の上の端より上へ出る高さ（px）。 */
export function getHeldTubeRisePx(tubeWidth: number): number {
  const unit = tubeWidth / TUBE_VIEW_WIDTH;
  const originX = HELD_TUBE_TILT_ORIGIN.x * TUBE_VIEW_WIDTH;
  const originY = HELD_TUBE_TILT_ORIGIN.y * TUBE_VIEW_HEIGHT;
  const radian = (-HELD_TUBE_TILT_DEG * Math.PI) / 180;
  const topY = Math.min(
    ...HELD_TUBE_TOP_POINTS.map(
      ([x, y]) =>
        originY +
        (x - originX) * Math.sin(radian) +
        (y - originY) * Math.cos(radian),
    ),
  );
  return HELD_TUBE_LIFT_PX + Math.max(0, -topY) * unit;
}
