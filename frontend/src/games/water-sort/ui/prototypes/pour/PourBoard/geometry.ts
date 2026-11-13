// 試験管の内側（局所座標、口が上、y は下向き）と、傾けたときの液面の高さ。
// 液の量は「立てたときの高さ」で数える単位（1単位 = UNIT_H）で持ち、傾けたときは断面の面積で釣り合わせる。

export const CAVITY_HALF_WIDTH = 22;
export const MOUTH_Y = 4;
const BOTTOM_ARC_CENTER_Y = 172;
export const BOTTOM_Y = 194;
export const UNIT_H = 36;

type Point = readonly [number, number];

const cavity: Point[] = (() => {
  const points: Point[] = [[-CAVITY_HALF_WIDTH, MOUTH_Y]];
  const arcSteps = 24;
  for (let k = 0; k <= arcSteps; k++) {
    const angle = Math.PI - (k * Math.PI) / arcSteps;
    points.push([
      CAVITY_HALF_WIDTH * Math.cos(angle),
      BOTTOM_ARC_CENTER_Y + CAVITY_HALF_WIDTH * Math.sin(angle),
    ]);
  }
  points.push([CAVITY_HALF_WIDTH, MOUTH_Y]);
  return points;
})();

export function traceCavity(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-CAVITY_HALF_WIDTH, MOUTH_Y);
  ctx.lineTo(-CAVITY_HALF_WIDTH, BOTTOM_ARC_CENTER_Y);
  ctx.arc(0, BOTTOM_ARC_CENTER_Y, CAVITY_HALF_WIDTH, Math.PI, 0, true);
  ctx.lineTo(CAVITY_HALF_WIDTH, MOUTH_Y);
  ctx.closePath();
}

/** 内側のうち、p・down ≥ t の部分の面積。down は局所座標での重力の向き。 */
function areaBeyond(downX: number, downY: number, t: number): number {
  const clipped: Point[] = [];
  const n = cavity.length;
  for (let i = 0; i < n; i++) {
    const a = cavity[i] as Point;
    const b = cavity[(i + 1) % n] as Point;
    const da = a[0] * downX + a[1] * downY - t;
    const db = b[0] * downX + b[1] * downY - t;
    if (da >= 0) clipped.push(a);
    if (da >= 0 !== db >= 0) {
      const r = da / (da - db);
      clipped.push([a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]);
    }
  }
  let area = 0;
  for (let i = 0; i < clipped.length; i++) {
    const a = clipped[i] as Point;
    const b = clipped[(i + 1) % clipped.length] as Point;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

function projectionRange(downX: number, downY: number): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const [x, y] of cavity) {
    const p = x * downX + y * downY;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return [min, max];
}

/** 面積 area を満たす水位 t（p・down = t の線）。 */
function levelForArea(downX: number, downY: number, area: number): number {
  let [lo, hi] = projectionRange(downX, downY);
  if (area <= 0) return hi;
  for (let k = 0; k < 26; k++) {
    const mid = (lo + hi) / 2;
    if (areaBeyond(downX, downY, mid) > area) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const MAX_UNITS = (BOTTOM_Y - MOUTH_Y) / UNIT_H;
const TABLE_STEP = 0.01;
const unitAreaTable: number[] = [];
for (let u = 0; u <= MAX_UNITS + TABLE_STEP; u += TABLE_STEP) {
  unitAreaTable.push(areaBeyond(0, 1, BOTTOM_Y - u * UNIT_H));
}

export function unitsToArea(units: number): number {
  const f = Math.max(0, Math.min(units / TABLE_STEP, unitAreaTable.length - 1));
  const i = Math.floor(f);
  const a = unitAreaTable[i] ?? 0;
  const b = unitAreaTable[Math.min(i + 1, unitAreaTable.length - 1)] ?? a;
  return a + (b - a) * (f - i);
}

export function areaToUnits(area: number): number {
  let lo = 0;
  let hi = unitAreaTable.length - 1;
  if (area <= 0) return 0;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((unitAreaTable[mid] ?? 0) < area) lo = mid;
    else hi = mid;
  }
  const a = unitAreaTable[lo] ?? 0;
  const b = unitAreaTable[hi] ?? a;
  return (lo + (b > a ? (area - a) / (b - a) : 0)) * TABLE_STEP;
}

/**
 * 傾き theta の試験管で、下から積んだ量 cumulativeUnits（世界の下から順）ごとの液面の位置。
 * 返す値は、管の原点から測った世界の y（下向き）。
 */
export function levelsForTilt(
  theta: number,
  cumulativeUnits: readonly number[],
): number[] {
  const downX = Math.sin(theta);
  const downY = Math.cos(theta);
  return cumulativeUnits.map((units) =>
    levelForArea(downX, downY, unitsToArea(units)),
  );
}

/** 傾き theta で、こぼれずに管に残せる量（単位）。 */
export function retainedUnits(theta: number): number {
  const downX = Math.sin(theta);
  const downY = Math.cos(theta);
  const lip = Math.max(
    -CAVITY_HALF_WIDTH * downX + MOUTH_Y * downY,
    CAVITY_HALF_WIDTH * downX + MOUTH_Y * downY,
  );
  return areaToUnits(areaBeyond(downX, downY, lip));
}

/** 残せる量が units になる傾き（0〜135°、正の向き）。 */
export function tiltForRetained(units: number): number {
  let lo = 0;
  let hi = (Math.PI * 3) / 4;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (retainedUnits(mid) > units) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
