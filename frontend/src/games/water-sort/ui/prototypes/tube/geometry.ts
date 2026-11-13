// 試作 tube の幾何。試験管1本の局所座標は、口の縁の中心を原点に、下を +y にとる。
// 光は画面の左上から当たる。影は右下へ落ちる。

/** 1単位の液の高さ（まっすぐな胴の部分）。 */
export const UNIT = 36;
/** 内側の底。 */
export const CAVITY_BOTTOM = 194;
/** 内側の半幅。 */
export const CAVITY_HALF = 22;
/** 内側の口の高さ。 */
export const CAVITY_TOP = 4;
export const CAVITY_PATH = "M-22,4 L-22,172 A22,22 0 0 0 22,172 L22,4 Z";
export const OUTER_PATH = "M-26,5 L-26,172 A26,26 0 0 0 26,172 L26,5";
export const OUTER_CLOSED_PATH = `${OUTER_PATH} Z`;

/** 立ての1段の高さ。 */
export const TIER_PITCH = 232;
/** 盤面の上に取る、持ち上げとコルクの余白。 */
export const RACK_TOP = 28;
/** 最下段の下に取る、板と床の影の余白。 */
export const RACK_BOTTOM_EXTRA = 222;
/** 板の左右の端から、端の穴の中心までの距離。 */
const BOARD_SIDE = 45;
const BOARD_X = 18;

export type Pose = { x: number; y: number; a: number };

export type RackLayout = {
  tiers: number;
  columns: number;
  pitch: number;
  width: number;
  height: number;
  boardX: number;
  boardWidth: number;
  scale: number;
};

export function pitchForColumns(columns: number): number {
  if (columns <= 4) return 88;
  if (columns === 5) return 78;
  return 70;
}

export function makeRackLayout(
  bottleCount: number,
  availableWidth: number,
  availableHeight: number,
): RackLayout {
  let best: RackLayout | null = null;
  for (const tiers of [1, 2, 3]) {
    const columns = Math.max(3, Math.ceil(bottleCount / tiers));
    if (tiers > 1 && Math.ceil(bottleCount / columns) < tiers) continue;
    const pitch = pitchForColumns(columns);
    const boardWidth = pitch * (columns - 1) + BOARD_SIDE * 2;
    const width = boardWidth + BOARD_X * 2;
    const height = RACK_TOP + (tiers - 1) * TIER_PITCH + RACK_BOTTOM_EXTRA;
    const scale = Math.min(
      availableWidth / width,
      availableHeight / height,
      1.15,
    );
    const layout: RackLayout = {
      tiers,
      columns,
      pitch,
      width,
      height,
      boardX: BOARD_X,
      boardWidth,
      scale,
    };
    if (!best || scale > best.scale + 0.01) best = layout;
  }
  // 少なくとも1つの候補は残る。
  return best as RackLayout;
}

export function columnX(layout: RackLayout, column: number): number {
  return layout.boardX + BOARD_SIDE + layout.pitch * column;
}

export function tierTop(tier: number): number {
  return RACK_TOP + tier * TIER_PITCH;
}

export function slotOf(layout: RackLayout, bottleIndex: number) {
  const tier = Math.floor(bottleIndex / layout.columns);
  const column = bottleIndex % layout.columns;
  return { tier, column, x: columnX(layout, column), y: tierTop(tier) };
}

export function restPose(layout: RackLayout, bottleIndex: number): Pose {
  const slot = slotOf(layout, bottleIndex);
  return { x: slot.x, y: slot.y, a: 0 };
}

/** 選んだ試験管: 穴から引き上げ、穴の所を支点に少し傾ける。 */
export const LIFT_HEIGHT = 36;
export const LIFT_ANGLE = 4;
export function liftPose(layout: RackLayout, bottleIndex: number): Pose {
  const rest = restPose(layout, bottleIndex);
  return rotateAround(
    { x: rest.x, y: rest.y - LIFT_HEIGHT, a: 0 },
    LIFT_ANGLE,
    25,
  );
}

/** 局所の (0, pivotY) を支点に da 度回したポーズ。 */
export function rotateAround(pose: Pose, da: number, pivotY: number): Pose {
  const [px, py] = apply(pose, 0, pivotY);
  const a = pose.a + da;
  const r = (a * Math.PI) / 180;
  return {
    x: px - -Math.sin(r) * pivotY,
    y: py - Math.cos(r) * pivotY,
    a,
  };
}

export function apply(pose: Pose, x: number, y: number): [number, number] {
  const r = (pose.a * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [pose.x + x * c - y * s, pose.y + x * s + y * c];
}

export function poseTransform(pose: Pose): string {
  return `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${pose.a.toFixed(2)})`;
}

export function lerpPose(from: Pose, to: Pose, t: number): Pose {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    a: from.a + (to.a - from.a) * t,
  };
}

/** 液の高さ（単位）から、立てた試験管の液面の局所の y。 */
export function uprightLevel(units: number): number {
  return CAVITY_BOTTOM - UNIT * units;
}

// ---- 傾けた試験管の液面: 内側を細かい点で埋め、体積（点の数）から水平な液面の高さを求める ----

const STEP = 1.25;
const sampleXs: number[] = [];
const sampleYs: number[] = [];
for (let y = CAVITY_TOP + STEP / 2; y < CAVITY_BOTTOM; y += STEP) {
  for (let x = -CAVITY_HALF + STEP / 2; x < CAVITY_HALF; x += STEP) {
    const inBody = y <= 172;
    const inBottom = x * x + (y - 172) ** 2 <= CAVITY_HALF * CAVITY_HALF;
    if (inBody || inBottom) {
      sampleXs.push(x);
      sampleYs.push(y);
    }
  }
}
const SAMPLE_COUNT = sampleXs.length;
const uprightAscending = Float32Array.from(sampleYs).sort();

/** 立てたとき、液面より下にある点の数（体積）。 */
function countForUnits(units: number): number {
  const h = uprightLevel(units);
  // h 以上の y を持つ点の数
  let lo = 0;
  let hi = SAMPLE_COUNT;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((uprightAscending[mid] ?? 0) < h) lo = mid + 1;
    else hi = mid;
  }
  return SAMPLE_COUNT - lo;
}

const sortedByAngle = new Map<number, Float32Array>();

/** 角度 a（度）で傾けたとき、各点の世界の y（原点は口の中心）を、低い所（y が大きい）から並べたもの。 */
function sortedHeights(a: number): Float32Array {
  const key = Math.round(a * 2) / 2;
  const cached = sortedByAngle.get(key);
  if (cached) return cached;
  const r = (key * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const heights = new Float32Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    heights[i] = -((sampleXs[i] ?? 0) * s + (sampleYs[i] ?? 0) * c);
  }
  heights.sort();
  for (let i = 0; i < SAMPLE_COUNT; i++) heights[i] = -(heights[i] ?? 0);
  if (sortedByAngle.size > 600) sortedByAngle.clear();
  sortedByAngle.set(key, heights);
  return heights;
}

/** 角度 a で傾けた試験管に units だけ液があるとき、液面の世界の y（ポーズの位置からの差）。 */
export function tiltedLevel(a: number, units: number): number {
  if (units <= 0) return Number.POSITIVE_INFINITY;
  const heights = sortedHeights(a);
  const n = Math.max(1, Math.min(SAMPLE_COUNT, countForUnits(units)));
  return heights[n - 1] ?? 0;
}

/** 口の縁で液がこぼれ始める側の点（局所）。sign が正なら右の縁（時計回りに傾けるとき）。 */
export function lipLocal(sign: number): [number, number] {
  return [CAVITY_HALF * sign, CAVITY_TOP];
}

const lipAngleTable: number[] = [];
const LIP_TABLE_STEP = 0.05;

/** units の液が、口の縁にちょうど届く傾き（度、正）。 */
export function lipAngle(units: number): number {
  if (lipAngleTable.length === 0) buildLipAngleTable();
  const v = Math.max(0, Math.min(4, units));
  const i = v / LIP_TABLE_STEP;
  const i0 = Math.floor(i);
  const a0 = lipAngleTable[i0] ?? 120;
  const a1 = lipAngleTable[Math.min(lipAngleTable.length - 1, i0 + 1)] ?? a0;
  return a0 + (a1 - a0) * (i - i0);
}

function buildLipAngleTable() {
  const steps = Math.round(4 / LIP_TABLE_STEP);
  for (let k = 0; k <= steps; k++) {
    const units = Math.max(0.04, k * LIP_TABLE_STEP);
    let found = 122;
    for (let a = 0; a <= 122; a += 1) {
      const r = (a * Math.PI) / 180;
      const lipY = CAVITY_HALF * Math.sin(r) + CAVITY_TOP * Math.cos(r);
      if (tiltedLevel(a, units) <= lipY) {
        // 1度の間を線形に詰める
        if (a > 0) {
          const pr = ((a - 1) * Math.PI) / 180;
          const pLip = CAVITY_HALF * Math.sin(pr) + CAVITY_TOP * Math.cos(pr);
          const pDiff = tiltedLevel(a - 1, units) - pLip;
          const diff = tiltedLevel(a, units) - lipY;
          found = a - 1 + pDiff / Math.max(1e-6, pDiff - diff);
        } else {
          found = 0;
        }
        break;
      }
    }
    lipAngleTable.push(Math.min(found, 122));
  }
}

// ---- 動きの曲線 ----
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeIn = (t: number) => t * t * t;
export function easeOutBack(t: number, s = 1.6): number {
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}
export const smoothstep = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};
