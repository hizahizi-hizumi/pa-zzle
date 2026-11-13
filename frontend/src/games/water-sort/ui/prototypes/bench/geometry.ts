// 試作 bench の形と配置。試験管の局所座標（単位: 試験管単位）と、立ての配置（px）を決める。

/** 1単位の液の高さ。 */
export const UNIT = 36;
/** 内側の底。 */
export const BOTTOM = 194;
/** 口の縁の高さ。 */
export const RIM = 4;
/** 内側の半径。 */
export const INNER_R = 22;
/** 底の丸みが始まる高さ。 */
export const HEMI_TOP = BOTTOM - INNER_R;
/** 回したり持ち上げたりするときの中心（局所座標）。 */
export const PIVOT_Y = 100;
/** 済んだ試験管が立ての中で深く収まる量。 */
export const SINK = 9;
/** 持ち上げる量。 */
export const LIFT = 44;
/** 穴の上で挿し入れを始める高さ（穴の前板の後ろへ回る高さ）。 */
export const INSERT_HEIGHT = 16;

export const CAVITY_D = `M${-INNER_R},${RIM} L${-INNER_R},${HEMI_TOP} A${INNER_R},${INNER_R} 0 0 0 ${INNER_R},${HEMI_TOP} L${INNER_R},${RIM} Z`;
export const OUTER_D = `M-26,5 L-26,${HEMI_TOP} A26,26 0 0 0 26,${HEMI_TOP} L26,5`;

/** u 単位の液の上端の高さ（立てたとき）。 */
export function levelY(units: number): number {
  return BOTTOM - units * UNIT;
}

// ---- 体積（傾けた試験管の液面を求める） ----

const SAMPLE_STEP = 0.5;
const samplesX: number[] = [];
const samplesY: number[] = [];
for (let y = RIM + SAMPLE_STEP / 2; y < BOTTOM; y += SAMPLE_STEP) {
  for (let x = -INNER_R + SAMPLE_STEP / 2; x < INNER_R; x += SAMPLE_STEP) {
    const inside =
      y <= HEMI_TOP || x * x + (y - HEMI_TOP) ** 2 <= INNER_R * INNER_R;
    if (inside) {
      samplesX.push(x);
      samplesY.push(y);
    }
  }
}
const SAMPLE_COUNT = samplesX.length;

/** 立てたとき、底から u 単位までに入る標本の数。 */
function samplesUpTo(units: number): number {
  const h = levelY(units);
  let n = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    if ((samplesY[i] as number) >= h) n++;
  }
  return n;
}
const UNIT_VOLUME_CACHE = new Map<number, number>();
/** 底から u 単位までの体積（標本の数）。 */
export function volumeOfUnits(units: number): number {
  const whole = Math.floor(units);
  const frac = units - whole;
  const at = (u: number) => {
    let v = UNIT_VOLUME_CACHE.get(u);
    if (v === undefined) {
      v = samplesUpTo(u);
      UNIT_VOLUME_CACHE.set(u, v);
    }
    return v;
  };
  if (frac === 0) return at(whole);
  return at(whole) + (at(whole + 1) - at(whole)) * frac;
}

function rotatedY(i: number, sin: number, cos: number) {
  return (samplesX[i] as number) * sin + (samplesY[i] as number) * cos;
}

/** 傾き a（度）で、口の縁 (±INNER_R, RIM) より下に入る体積。 */
function capacityAt(angleDeg: number): number {
  const r = (Math.abs(angleDeg) * Math.PI) / 180;
  const s = Math.sin(r);
  const c = Math.cos(r);
  const lip = INNER_R * s + RIM * c;
  let n = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    if (rotatedY(i, s, c) > lip) n++;
  }
  return n;
}

let capacityTable: number[] | null = null;
const TABLE_STEP = 0.5;
const TABLE_MAX = 92;
function getCapacityTable() {
  if (!capacityTable) {
    capacityTable = [];
    for (let a = 0; a <= TABLE_MAX; a += TABLE_STEP) {
      capacityTable.push(capacityAt(a));
    }
  }
  return capacityTable;
}

/** 体積 v の液の液面がちょうど口の縁に届く傾き（度、正）。 */
export function angleForVolume(volume: number): number {
  const table = getCapacityTable();
  if (volume >= (table[0] as number)) return 0;
  for (let i = 1; i < table.length; i++) {
    const cap = table[i] as number;
    if (cap <= volume) {
      const prev = table[i - 1] as number;
      const t = prev === cap ? 0 : (prev - volume) / (prev - cap);
      return (i - 1 + t) * TABLE_STEP;
    }
  }
  return TABLE_MAX;
}

export type TiltedBand = { color: number; top: number; bottom: number };

/**
 * 傾き a（度）の試験管に、下から layers（色と単位の数）が入っているときの、
 * 回した座標での水平な層の帯。`volumeScale` は全体の量の割合ではなく、最上層の量を減らすのに使う。
 */
export function tiltedBands(
  layers: readonly { color: number; units: number }[],
  angleDeg: number,
): { bands: TiltedBand[]; surface: number | null } {
  const r = (angleDeg * Math.PI) / 180;
  const s = Math.sin(r);
  const c = Math.cos(r);
  // 回した座標の y の分布（大きいほど下）
  const BIN = 0.5;
  const MIN = -260;
  const BINS = 1040;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const y = rotatedY(i, s, c);
    const b = Math.min(BINS - 1, Math.max(0, Math.floor((y - MIN) / BIN)));
    hist[b] = (hist[b] as number) + 1;
  }
  // 下から体積 v を満たす高さ
  const levelFor = (v: number) => {
    if (v <= 0) return Number.POSITIVE_INFINITY;
    let acc = 0;
    for (let b = BINS - 1; b >= 0; b--) {
      const n = hist[b] as number;
      if (acc + n >= v) {
        const t = n === 0 ? 0 : (v - acc) / n;
        return MIN + (b + 1 - t) * BIN;
      }
      acc += n;
    }
    return MIN;
  };
  // 各層の体積（下から）
  const volumes: number[] = [];
  let unitsSoFar = 0;
  let prevVolume = 0;
  for (const layer of layers) {
    unitsSoFar += layer.units;
    const v = volumeOfUnits(unitsSoFar);
    volumes.push(v - prevVolume);
    prevVolume = v;
  }
  const bands: TiltedBand[] = [];
  const mouthDown = c <= 0;
  const order = mouthDown
    ? layers.map((_, i) => layers.length - 1 - i)
    : layers.map((_, i) => i);
  let filled = 0;
  for (const index of order) {
    const layer = layers[index];
    const v = volumes[index] as number;
    if (!layer || v <= 0) continue;
    const bottom = filled === 0 ? 400 : levelFor(filled);
    filled += v;
    const top = levelFor(filled);
    bands.push({ color: layer.color, top, bottom });
  }
  return { bands, surface: filled > 0 ? levelFor(filled) : null };
}

// ---- 姿勢 ----

export type Pose = {
  /** 局所 (0, PIVOT_Y) の位置（px）。 */
  x: number;
  y: number;
  /** 傾き（度、時計回り）。 */
  angle: number;
  /** 大きさの倍率。 */
  scale: number;
  /** 立ての前板の後ろ（穴の中）か、前（持ち上げて手前）か。 */
  layer: "rack" | "front";
};

export function poseTransform(pose: Pose, k: number): string {
  return `translate(${pose.x} ${pose.y}) rotate(${pose.angle}) scale(${k * pose.scale}) translate(0 ${-PIVOT_Y})`;
}

/** 局所座標の点を、姿勢で px へ写す。 */
export function poseToWorld(
  pose: Pose,
  k: number,
  lx: number,
  ly: number,
): [number, number] {
  const r = (pose.angle * Math.PI) / 180;
  const s = Math.sin(r);
  const c = Math.cos(r);
  const dx = lx * k * pose.scale;
  const dy = (ly - PIVOT_Y) * k * pose.scale;
  return [pose.x + dx * c - dy * s, pose.y + dx * s + dy * c];
}

/** 局所の点 (lx, ly) が px の点 P に来るような、傾き a の姿勢の中心。 */
export function centerForPoint(
  px: number,
  py: number,
  lx: number,
  ly: number,
  angleDeg: number,
  k: number,
): [number, number] {
  const r = (angleDeg * Math.PI) / 180;
  const s = Math.sin(r);
  const c = Math.cos(r);
  const dx = lx * k;
  const dy = (ly - PIVOT_Y) * k;
  return [px - (dx * c - dy * s), py - (dx * s + dy * c)];
}

// ---- 立ての配置 ----

/** 立ての横の柱と余白（試験管単位）。 */
export const RACK_SIDE = 18;
/** 段の高さ: 口の縁(0)から台の前板の下まで。 */
export const TIER_HEIGHT = 220;
/** 段の間隔。 */
export const TIER_PITCH = 240;
/** 上に取る持ち上げの余白。 */
const TOP_RESERVE = 22;
const MIN_PITCH_X = 72;
const MAX_PITCH_X = 112;

export type Slot = {
  index: number;
  row: number;
  /** 試験管の局所 (0,0) を置く px。 */
  x: number;
  y: number;
};

export type BenchLayout = {
  width: number;
  height: number;
  k: number;
  rows: number;
  columns: number;
  pitchX: number;
  rackLeft: number;
  rackTop: number;
  rackWidthUnits: number;
  rackHeightUnits: number;
  rackBottom: number;
  rowCounts: number[];
  slots: Slot[];
};

export function computeBenchLayout(
  count: number,
  width: number,
  height: number,
): BenchLayout {
  let best: BenchLayout | null = null;
  for (const rows of [1, 2]) {
    const columns = Math.ceil(count / rows);
    const rackHeightUnits = (rows - 1) * TIER_PITCH + TIER_HEIGHT;
    const kByWidth = (width * 0.97) / (2 * RACK_SIDE + columns * MIN_PITCH_X);
    const kByHeight = (height - 4) / (rackHeightUnits + TOP_RESERVE);
    const k = Math.max(0.2, Math.min(kByWidth, kByHeight, 1.45));
    const pitchX = Math.min(
      MAX_PITCH_X,
      Math.max(MIN_PITCH_X, (width * 0.97) / k - 2 * RACK_SIDE) / columns,
    );
    const rackWidthUnits = 2 * RACK_SIDE + columns * pitchX;
    const rackBottom = height - 2;
    const rackTop = rackBottom - rackHeightUnits * k;
    const rackLeft = (width - rackWidthUnits * k) / 2;
    const rowCounts: number[] = [];
    for (let r = 0; r < rows; r++) {
      rowCounts.push(Math.min(columns, count - r * columns));
    }
    const slots: Slot[] = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const inRow = rowCounts[row] ?? columns;
      const offset = ((columns - inRow) / 2) * pitchX;
      slots.push({
        index: i,
        row,
        x: rackLeft + (RACK_SIDE + offset + pitchX * (col + 0.5)) * k,
        y: rackTop + row * TIER_PITCH * k,
      });
    }
    const layout: BenchLayout = {
      width,
      height,
      k,
      rows,
      columns,
      pitchX,
      rackLeft,
      rackTop,
      rackWidthUnits,
      rackHeightUnits,
      rackBottom,
      rowCounts,
      slots,
    };
    if (!best || k > best.k + 0.001) best = layout;
  }
  return best as BenchLayout;
}

// ---- ゆるみ ----

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeIn = (t: number) => t * t * t;
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t: number, s = 1.6) =>
  1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
