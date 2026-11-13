// 試作 light の盤面の寸法と色。座標は SVG の viewBox の単位。
// 光は左上の窓から1方向に差す。ガラスの照り返しは左側、透過光の色溜まりは管の真下から右下へ落ちる。

export const TUBE = {
  /** ガラスの外側の半径 */
  RO: 20,
  /** 中の空洞の半径 */
  RI: 17,
  /** 1単位の液の高さ */
  U: 27,
  /** 空洞の上端（口の縁の少し下） */
  CAV_TOP: 3,
  /** 満杯でも残る空き */
  HEAD: 13,
} as const;

/** 空洞の底（内側） */
export const BOT = TUBE.CAV_TOP + TUBE.HEAD + 4 * TUBE.U;
/** ガラスの外側の底 */
export const OUTER_BOT = BOT - TUBE.RI + TUBE.RO;
/** 空洞の高さ */
export const CAVITY_H = BOT - TUBE.CAV_TOP;

export const LIFT = 17;

/** 段の中の位置（管の口の高さ ty からの差） */
export const TIER = {
  holeTop: 10,
  holeDepth: 9,
  holeFront: 8,
  shelfBack: OUTER_BOT - 11,
  shelfDepth: 50,
  shelfFrontH: 13,
} as const;

export const SHELF_FRONT = TIER.shelfBack + TIER.shelfDepth;
export const TIER_BOTTOM = SHELF_FRONT + TIER.shelfFrontH;
const TIER_GAP = 14;
const TIER_PITCH = TIER_BOTTOM + TIER_GAP;
const TOP_MARGIN = 26;
const BOTTOM_MARGIN = 10;
const COLUMN_PITCH = 62;
const SIDE_LEFT = 28;
/** 右は色影が伸びる分だけ広くとる */
const SIDE_RIGHT = 50;

export const RACK = {
  postW: 11,
  sideInset: 6,
} as const;

export type Slot = {
  x: number;
  /** 管の口の高さ（持ち上げていないとき） */
  ty: number;
  tier: 0 | 1;
};

export type SceneLayout = {
  width: number;
  height: number;
  columnCount: number;
  tierTops: readonly [number, number];
  slots: readonly Slot[];
  rackLeft: number;
  rackRight: number;
};

export function getSceneLayout(bottleCount: number): SceneLayout {
  const columnCount = Math.max(3, Math.ceil(bottleCount / 2));
  const width = SIDE_LEFT + SIDE_RIGHT + columnCount * COLUMN_PITCH;
  const tierTops = [TOP_MARGIN, TOP_MARGIN + TIER_PITCH] as const;
  const height = tierTops[1] + TIER_BOTTOM + BOTTOM_MARGIN;
  const slots: Slot[] = [];
  const secondRowCount = bottleCount - columnCount;
  for (let i = 0; i < bottleCount; i += 1) {
    const tier: 0 | 1 = i < columnCount ? 0 : 1;
    const column = tier === 0 ? i : i - columnCount;
    const rowCount = tier === 0 ? columnCount : secondRowCount;
    const offset = ((columnCount - rowCount) * COLUMN_PITCH) / 2;
    slots.push({
      x: SIDE_LEFT + offset + COLUMN_PITCH * (column + 0.5),
      ty: tierTops[tier],
      tier,
    });
  }
  return {
    width,
    height,
    columnCount,
    tierTops,
    slots,
    rackLeft: RACK.sideInset,
    rackRight: width - RACK.sideInset,
  };
}

/** 液の色。明るい側（光の入る側）と暗い側。 */
const LIQUID_COLORS: readonly (readonly [string, string])[] = [
  ["#f05252", "#b5232d"],
  ["#4583f2", "#1f46b3"],
  ["#3fc06b", "#1b8a45"],
  ["#ffd43f", "#dc9f0e"],
  ["#a95fec", "#6a2cbb"],
  ["#ff9b3d", "#d6621a"],
  ["#6fd7f3", "#2399c2"],
  ["#ff7fbf", "#cc3a86"],
  ["#bde04c", "#7fa519"],
  ["#c9b0ff", "#8a6dd8"],
  ["#d3d9e1", "#8d99a8"],
  ["#3fb7b2", "#1a7a7c"],
];

export function liquidColor(colorIndex: number): readonly [string, string] {
  return (
    LIQUID_COLORS[colorIndex] ?? [
      `hsl(${(colorIndex * 47) % 360} 75% 60%)`,
      `hsl(${(colorIndex * 47) % 360} 70% 40%)`,
    ]
  );
}

function parseColor(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    const n = Number.parseInt(color.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  return [180, 180, 180];
}

export function mixColor(a: string, b: string, k: number): string {
  const [r1, g1, b1] = parseColor(a);
  const [r2, g2, b2] = parseColor(b);
  const r = Math.round(r1 + (r2 - r1) * k);
  const g = Math.round(g1 + (g2 - g1) * k);
  const bl = Math.round(b1 + (b2 - b1) * k);
  return `rgb(${r},${g},${bl})`;
}

export function lighten(color: string, k: number): string {
  return mixColor(color, "#ffffff", k);
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function easeInOut(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

export function easeOut(t: number): number {
  const c = clamp01(t);
  return 1 - (1 - c) ** 3;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
