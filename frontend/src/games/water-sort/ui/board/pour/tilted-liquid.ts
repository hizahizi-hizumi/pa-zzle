import {
  TUBE_INNER,
  TUBE_MOUTH_RATIO,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

/**
 * 傾けた試験管の中の液を、液面が水平になるように求める。
 * 座標は試験管の形の座標（幅 36・高さ 100、上が y=0）で、試験管と一緒に傾く。
 * 傾きは試験管の回し方（CSS の rotate、時計回りが正）で、口のある上の端の中央を中心に回す。
 */

export type TubePoint = readonly [number, number];
type Polygon = readonly TubePoint[];

export type TubeSegment = readonly [TubePoint, TubePoint];

const SLOT_COUNT = 4;
const SLOT_HEIGHT = (TUBE_INNER.bottom - TUBE_INNER.slotTop) / SLOT_COUNT;
/** 液が寄れる上の端。傾けると、立てたときの4段目より上の首にも液が寄る。 */
const NECK_TOP = TUBE_MOUTH_RATIO * 100;
const BOTTOM_ARC_SEGMENTS = 16;
const SEARCH_STEPS = 30;

const interior: Polygon = createInterior();

/** 管の内側。底は浅い楕円で、立てたときの見え方（`LIQUID_BOX_STYLE` の丸み）と同じ形にする。 */
function createInterior(): Polygon {
  const { left, right, bottom, bottomDepth } = TUBE_INNER;
  const centerX = (left + right) / 2;
  const centerY = bottom - bottomDepth;
  const radiusX = (right - left) / 2;
  const arc = Array.from(
    { length: BOTTOM_ARC_SEGMENTS + 1 },
    (_, index): TubePoint => {
      const angle = (Math.PI * index) / BOTTOM_ARC_SEGMENTS;
      return [
        centerX + radiusX * Math.cos(angle),
        centerY + bottomDepth * Math.sin(angle),
      ];
    },
  );
  return [[left, NECK_TOP], [right, NECK_TOP], ...arc];
}

/** 試験管の中で見た、下（重力）の向き。 */
function getDown(tiltDeg: number): TubePoint {
  const radian = (tiltDeg * Math.PI) / 180;
  return [Math.sin(radian), Math.cos(radian)];
}

function depthOf([x, y]: TubePoint, down: TubePoint): number {
  return x * down[0] + y * down[1];
}

/** `keepDeeper` なら深さ `level` より深い側、そうでなければ浅い側を残す。 */
function clipByLevel(
  polygon: Polygon,
  down: TubePoint,
  level: number,
  keepDeeper: boolean,
): Polygon {
  const result: TubePoint[] = [];
  polygon.forEach((current, index) => {
    const next = polygon[(index + 1) % polygon.length] ?? current;
    const currentDepth = depthOf(current, down) - level;
    const nextDepth = depthOf(next, down) - level;
    const currentInside = keepDeeper ? currentDepth >= 0 : currentDepth <= 0;
    const nextInside = keepDeeper ? nextDepth >= 0 : nextDepth <= 0;
    if (currentInside) {
      result.push(current);
    }
    if (currentInside !== nextInside) {
      const ratio = currentDepth / (currentDepth - nextDepth);
      result.push([
        current[0] + (next[0] - current[0]) * ratio,
        current[1] + (next[1] - current[1]) * ratio,
      ]);
    }
  });
  return result;
}

function areaOf(polygon: Polygon): number {
  let sum = 0;
  polygon.forEach((current, index) => {
    const next = polygon[(index + 1) % polygon.length] ?? current;
    sum += current[0] * next[1] - next[0] * current[1];
  });
  return Math.abs(sum) / 2;
}

const UPRIGHT_DOWN: TubePoint = [0, 1];

/** 立てたときに下から `slots` 段（小数も取る）まで満ちる液の量（面積）。 */
function getVolume(slots: number): number {
  const surfaceY = TUBE_INNER.bottom - SLOT_HEIGHT * slots;
  return areaOf(clipByLevel(interior, UPRIGHT_DOWN, surfaceY, true));
}

/** `slots` 段の液が溜まったときの液面の深さ。 */
function getLevel(down: TubePoint, slots: number): number {
  const target = getVolume(slots);
  const depths = interior.map((point) => depthOf(point, down));
  let shallow = Math.min(...depths);
  let deep = Math.max(...depths);
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (shallow + deep) / 2;
    if (areaOf(clipByLevel(interior, down, middle, true)) > target) {
      shallow = middle;
    } else {
      deep = middle;
    }
  }
  return (shallow + deep) / 2;
}

/** 右へ `tiltDeg` 度傾けたとき、口の右の縁からこぼれずに残せる液の量（面積）。 */
function getRetainedVolume(tiltDeg: number): number {
  const down = getDown(tiltDeg);
  const lip: TubePoint = [TUBE_INNER.right, NECK_TOP];
  return areaOf(clipByLevel(interior, down, depthOf(lip, down), true));
}

/**
 * 残っている `slots` 段の液が、ちょうど口の縁に届く傾き（度、向きを除いた大きさ）。
 * 満ちているほど浅く、残りが少ないほど深い。液が無ければ管が水平になる 90 度。
 */
export function getLipReachingTiltDeg(slots: number): number {
  const target = getVolume(slots);
  let low = 0;
  let high = 90;
  if (getRetainedVolume(low) <= target) {
    return low;
  }
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (getRetainedVolume(middle) > target) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

export type TiltedLiquidRun = {
  colorIndex: number;
  /** 下から数えた段の始まりと終わり。 */
  fromSlot: number;
  toSlot: number;
};

export type TiltedLiquidLayer = {
  colorIndex: number;
  points: Polygon;
};

export type TiltedLiquid = {
  /** `runs` と同じ順。注ぎ出して量の無い層は、点を持たない。 */
  layers: readonly TiltedLiquidLayer[];
  /** 層と層の境目の線。 */
  boundaries: readonly TubeSegment[];
  /** 液面の線。液が無ければ `null`。 */
  surface: TubeSegment | null;
};

/** 深さ `level` の水平な線が、管の内側を横切る区間。 */
function getLevelSegment(down: TubePoint, level: number): TubeSegment | null {
  const across: TubePoint = [down[1], -down[0]];
  const onLevel = clipByLevel(interior, down, level, true).filter(
    (point) => Math.abs(depthOf(point, down) - level) < 1e-6,
  );
  if (onLevel.length < 2) {
    return null;
  }
  const sorted = [...onLevel].sort(
    (a, b) => depthOf(a, across) - depthOf(b, across),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first && last ? [first, last] : null;
}

/**
 * `tiltDeg` 度傾けた試験管の中で、`runs` の層が `amount` 段まで残っているときの形。
 * `amount` より上の層は、もう注ぎ出している。
 */
export function getTiltedLiquid(
  runs: readonly TiltedLiquidRun[],
  amount: number,
  tiltDeg: number,
): TiltedLiquid {
  const down = getDown(tiltDeg);
  const levelCache = new Map<number, number>();
  function levelOf(slots: number): number {
    const cached = levelCache.get(slots);
    if (cached !== undefined) {
      return cached;
    }
    const level = getLevel(down, slots);
    levelCache.set(slots, level);
    return level;
  }

  const layers: TiltedLiquidLayer[] = [];
  const boundaries: TubeSegment[] = [];
  for (const run of runs) {
    const toSlot = Math.min(run.toSlot, amount);
    if (toSlot <= run.fromSlot) {
      layers.push({ colorIndex: run.colorIndex, points: [] });
      continue;
    }
    const deepLevel = levelOf(run.fromSlot);
    const shallowLevel = levelOf(toSlot);
    const points = clipByLevel(
      clipByLevel(interior, down, shallowLevel, true),
      down,
      deepLevel,
      false,
    );
    if (run.fromSlot > 0) {
      const boundary = getLevelSegment(down, deepLevel);
      if (boundary) {
        boundaries.push(boundary);
      }
    }
    layers.push({ colorIndex: run.colorIndex, points });
  }

  return {
    layers,
    boundaries,
    surface: amount > 0 ? getLevelSegment(down, levelOf(amount)) : null,
  };
}

/** 中身（下から順の色番号）を、同じ試薬が続く段をひとつの層にまとめる。 */
export function getTiltedLiquidRuns(
  contents: readonly number[],
): TiltedLiquidRun[] {
  const runs: TiltedLiquidRun[] = [];
  contents.forEach((colorIndex, slotIndex) => {
    const last = runs[runs.length - 1];
    if (last && last.colorIndex === colorIndex) {
      last.toSlot = slotIndex + 1;
      return;
    }
    runs.push({ colorIndex, fromSlot: slotIndex, toSlot: slotIndex + 1 });
  });
  return runs;
}

/** 管の内側の形（試験管の形の座標）。傾けた液の線を、管の内側で切るのに使う。 */
export const TUBE_INTERIOR_POINTS: readonly TubePoint[] = interior;

export const _private = { getVolume, getLevel, areaOf };
