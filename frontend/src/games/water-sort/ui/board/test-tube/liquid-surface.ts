/**
 * 液面と層の境目の描き方。どの液も同じに描く。
 * 液面は、縁の暗い線とその下の明るい帯。層の境目は、明るい細い線。
 */
export const LIQUID_SURFACE = {
  shadeColor: "rgba(20, 30, 35, 0.32)",
  shadePx: 1,
  highlightColor: "rgba(255, 255, 255, 0.5)",
  highlightPx: 1.6,
} as const;

export const LIQUID_BOUNDARY = {
  color: "rgba(255, 255, 255, 0.45)",
  px: 1,
} as const;
