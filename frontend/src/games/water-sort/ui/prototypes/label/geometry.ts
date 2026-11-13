// 試作 label: 試験管立ての寸法と、傾けた試験管の液面を体積から求める計算。
// 座標は SVG の利用者単位。試験管の局所座標は口の中心を原点にし、下へ y が増える。

/** 1単位の液の高さ。 */
export const UNIT = 36;
/** 内側の底。 */
export const CAVITY_BOTTOM = 194;
export const CAVITY_TOP = 4;
export const CAVITY_HALF = 22;
export const OUTER_HALF = 26;
const ARC_CENTER_Y = CAVITY_BOTTOM - CAVITY_HALF;

/** 1段の高さ。段の原点（試験管の口）から、次の段の口まで。 */
export const TIER_PITCH = 240;
/** 盤面の上に取る余白。持ち上げとコルクの分。 */
export const TOP_MARGIN = 20;
/** 立ての左右の柱の外側から最初の穴の列の端まで。 */
export const SIDE = 20;
/** 床の影の分。 */
const BOTTOM_EXTRA = 222;

/** 選んだ管を持ち上げる量と傾き。 */
export const LIFT_HEIGHT = 20;
export const LIFT_ANGLE = 5;
const LIFT_PIVOT_Y = 40;

export type RackLayout = {
  columns: number;
  rows: number;
  spacing: number;
  width: number;
  height: number;
  scale: number;
  slots: { cx: number; ty: number; row: number; column: number }[];
};

function naturalSize(columns: number, rows: number) {
  const spacing = columns >= 6 ? 72 : columns === 5 ? 80 : 88;
  return {
    spacing,
    width: columns * spacing + SIDE * 2,
    height: TOP_MARGIN + (rows - 1) * TIER_PITCH + BOTTOM_EXTRA,
  };
}

export function chooseRackLayout(
  bottleCount: number,
  availableWidth: number,
  availableHeight: number,
): RackLayout {
  let best: RackLayout | null = null;
  for (const rows of [2, 3]) {
    const columns = Math.max(3, Math.ceil(bottleCount / rows));
    if (rows > 2 && Math.ceil(bottleCount / columns) < rows) {
      continue;
    }
    const { spacing, width, height } = naturalSize(columns, rows);
    const scale = Math.min(availableWidth / width, availableHeight / height, 1.25);
    if (!best || scale > best.scale + 0.001) {
      const slots = Array.from({ length: bottleCount }, (_, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        return {
          cx: SIDE + spacing * (column + 0.5),
          ty: TOP_MARGIN + row * TIER_PITCH,
          row,
          column,
        };
      });
      best = { columns, rows, spacing, width, height, scale, slots };
    }
  }
  if (!best) {
    throw new Error("layout");
  }
  return best;
}

export type Pose = { x: number; y: number; angle: number };

const rad = (degree: number) => (degree * Math.PI) / 180;

/** 口を原点にした姿勢から、局所座標を世界座標へ。 */
export function toWorld(pose: Pose, x: number, y: number): [number, number] {
  const c = Math.cos(rad(pose.angle));
  const s = Math.sin(rad(pose.angle));
  return [pose.x + x * c - y * s, pose.y + x * s + y * c];
}

export function poseTransform(pose: Pose): string {
  return `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${pose.angle.toFixed(2)})`;
}

export function inverseTransform(pose: Pose): string {
  return `rotate(${(-pose.angle).toFixed(2)}) translate(${(-pose.x).toFixed(2)} ${(-pose.y).toFixed(2)})`;
}

/** 置かれた穴から持ち上げた姿勢。`lift` は 0〜1。 */
export function liftedPose(cx: number, ty: number, lift: number): Pose {
  const angle = LIFT_ANGLE * lift;
  const s = Math.sin(rad(angle));
  const c = Math.cos(rad(angle));
  return {
    x: cx + LIFT_PIVOT_Y * s,
    y: ty - LIFT_HEIGHT * lift + LIFT_PIVOT_Y - LIFT_PIVOT_Y * c,
    angle,
  };
}

// ---- 内側の形 ----

const cavityLocal: [number, number][] = (() => {
  const points: [number, number][] = [
    [-CAVITY_HALF, CAVITY_TOP],
    [-CAVITY_HALF, ARC_CENTER_Y],
  ];
  const steps = 14;
  for (let index = 1; index < steps; index += 1) {
    const theta = Math.PI - (Math.PI * index) / steps;
    points.push([
      CAVITY_HALF * Math.cos(theta),
      ARC_CENTER_Y + CAVITY_HALF * Math.sin(theta),
    ]);
  }
  points.push([CAVITY_HALF, ARC_CENTER_Y], [CAVITY_HALF, CAVITY_TOP]);
  return points;
})();

export const CAVITY_PATH = `M${-CAVITY_HALF},${CAVITY_TOP} L${-CAVITY_HALF},${ARC_CENTER_Y} A${CAVITY_HALF},${CAVITY_HALF} 0 0 0 ${CAVITY_HALF},${ARC_CENTER_Y} L${CAVITY_HALF},${CAVITY_TOP} Z`;
export const OUTER_PATH = `M${-OUTER_HALF},5 L${-OUTER_HALF},${ARC_CENTER_Y} A${OUTER_HALF},${OUTER_HALF} 0 0 0 ${OUTER_HALF},${ARC_CENTER_Y} L${OUTER_HALF},5`;
export const OUTER_CLOSED_PATH = `${OUTER_PATH} Z`;

/** 多角形のうち y >= h の部分の面積。 */
function areaBelow(points: readonly [number, number][], h: number): number {
  const clipped: [number, number][] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index] as [number, number];
    const next = points[(index + 1) % points.length] as [number, number];
    const currentIn = current[1] >= h;
    const nextIn = next[1] >= h;
    if (currentIn) {
      clipped.push(current);
    }
    if (currentIn !== nextIn) {
      const t = (h - current[1]) / (next[1] - current[1]);
      clipped.push([current[0] + (next[0] - current[0]) * t, h]);
    }
  }
  let area = 0;
  for (let index = 0; index < clipped.length; index += 1) {
    const [x1, y1] = clipped[index] as [number, number];
    const [x2, y2] = clipped[(index + 1) % clipped.length] as [number, number];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

/** 立てた管で、下から `amount` 単位までの体積。 */
export function uprightVolume(amount: number): number {
  return areaBelow(cavityLocal, CAVITY_BOTTOM - UNIT * amount);
}

/** 傾けた管で、下から積んだ体積 `volume` の液面の世界座標の高さ。 */
export function tiltedLevel(pose: Pose, volume: number): number {
  const world = cavityLocal.map(([x, y]) => toWorld(pose, x, y));
  let low = Math.min(...world.map((point) => point[1]));
  let high = Math.max(...world.map((point) => point[1]));
  if (volume <= 0) {
    return high;
  }
  for (let iteration = 0; iteration < 22; iteration += 1) {
    const middle = (low + high) / 2;
    if (areaBelow(world, middle) > volume) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

/** 世界の高さ h で、管の軸が通る x。 */
export function axisXAt(pose: Pose, h: number): number {
  const [x0, y0] = toWorld(pose, 0, 0);
  const [x1, y1] = toWorld(pose, 0, 100);
  if (Math.abs(y1 - y0) < 0.001) {
    return x0;
  }
  return x0 + ((x1 - x0) * (h - y0)) / (y1 - y0);
}
