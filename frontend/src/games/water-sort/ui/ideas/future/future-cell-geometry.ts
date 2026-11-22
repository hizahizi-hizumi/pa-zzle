/**
 * 収容管の形。ボトルの箱（幅:高さ = 0.36）を 36×100 の座標で描くので、座標はそのまま箱に対する割合になる。
 * 液の入る内側は、4段が同じ高さになるよう、まっすぐな管の中だけに取る。
 */
export const CELL_VIEW_WIDTH = 36;
export const CELL_VIEW_HEIGHT = 100;

export const CELL_TUBE = {
  left: 5.2,
  right: 30.8,
  top: 8,
  bottom: 89,
} as const;
export const CELL_FLUID = {
  left: 7.6,
  right: 28.4,
  top: 12,
  bottom: 86,
} as const;

/** 口金。液が出入りする口はこの上面にある。 */
export const CELL_COLLAR = { left: 3.2, right: 32.8, bottom: 9.2 } as const;

/** 液が出入りする口の中心（箱に対する割合）。 */
export const CELL_MOUTH = { x: 0.5, y: 0.004 } as const;

export function toBoxPercent(
  value: number,
  axis: "x" | "y",
  from: "start" | "end" = "start",
): string {
  const size = axis === "x" ? CELL_VIEW_WIDTH : CELL_VIEW_HEIGHT;
  const position = from === "start" ? value : size - value;
  return `${(position / size) * 100}%`;
}

/** 液の段 `slot`（0 が底）の上端の高さ（箱の上端からの割合）。 */
export function getFluidSurfaceRatio(slots: number): number {
  const height = CELL_FLUID.bottom - CELL_FLUID.top;
  return (CELL_FLUID.bottom - (height * slots) / 4) / CELL_VIEW_HEIGHT;
}
