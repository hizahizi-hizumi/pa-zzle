import {
  BAR_GLASS,
  BAR_GLASS_SLOT,
} from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";

/**
 * 傾けたグラスの中の液を、液面が水平になるように求める。
 * 座標はグラスの枠（幅 `width`・高さ `height`、上が y=0）の中の px で、グラスと一緒に傾く。
 * 角度はグラスの回し方（CSS の rotate、時計回りが正）。
 */

type Point = readonly [number, number];
type Polygon = readonly Point[];

type GlassBox = {
  width: number;
  height: number;
};

/** 液が入りうるグラスの内側。傾けると、立てたときの液面より上（口の縁まで）にも液が寄る。 */
function getInterior({ width, height }: GlassBox): Polygon {
  const left = width * BAR_GLASS.wallInset;
  const right = width - left;
  const top = height * 0.012;
  const bottom = height * BAR_GLASS.baseTop;
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
}

function getSlotArea({ width, height }: GlassBox): number {
  return width * (1 - BAR_GLASS.wallInset * 2) * height * BAR_GLASS_SLOT;
}

/** グラスの中で見た、下（重力）の向き。 */
function getDown(angleRad: number): Point {
  return [Math.sin(angleRad), Math.cos(angleRad)];
}

function depthOf([x, y]: Point, down: Point): number {
  return x * down[0] + y * down[1];
}

/** `keepDeeper` なら深さ `level` より深い側、そうでなければ浅い側を残す。 */
function clipByLevel(
  polygon: Polygon,
  down: Point,
  level: number,
  keepDeeper: boolean,
): Polygon {
  const result: Point[] = [];
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

/** `slots` 段分の液が溜まったときの液面の深さ。 */
function getLevelForVolume(
  interior: Polygon,
  down: Point,
  slots: number,
  slotArea: number,
): number {
  const depths = interior.map((point) => depthOf(point, down));
  let shallow = Math.min(...depths);
  let deep = Math.max(...depths);
  const target = slots * slotArea;
  for (let step = 0; step < 28; step += 1) {
    const middle = (shallow + deep) / 2;
    if (areaOf(clipByLevel(interior, down, middle, true)) > target) {
      shallow = middle;
    } else {
      deep = middle;
    }
  }
  return (shallow + deep) / 2;
}

/**
 * 口の縁（`direction` の側の上の角）からこぼれずに残せる液の量（段）。
 * 注いでいる間は、残っている液がちょうど縁に届く角度まで傾ける。
 */
function getCapacity(
  box: GlassBox,
  angleRad: number,
  direction: 1 | -1,
): number {
  const interior = getInterior(box);
  const lip = direction > 0 ? interior[1] : interior[0];
  if (!lip) {
    return 0;
  }
  const down = getDown(angleRad);
  const retained = clipByLevel(interior, down, depthOf(lip, down), true);
  return areaOf(retained) / getSlotArea(box);
}

/** 残っている液 `slots` 段が、ちょうど口の縁に届く傾き（度、向きを含む）。 */
export function getPouringTiltDeg(
  box: GlassBox,
  slots: number,
  direction: 1 | -1,
): number {
  let low = 0;
  let high = 150;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (
      getCapacity(box, (direction * middle * Math.PI) / 180, direction) > slots
    ) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return direction * ((low + high) / 2);
}

export type TiltedLiquidRun = {
  colorIndex: number;
  /** 下から数えた段の始まりと終わり。 */
  fromSlot: number;
  toSlot: number;
};

export type TiltedLiquidShape = {
  polygons: readonly string[];
  /** 液面の線（SVG の points）。液が無ければ空。 */
  surface: string;
};

function toPoints(polygon: Polygon): string {
  return polygon.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/** 層ごとの形（SVG の points）。`amount` 段より上は、もう注ぎ出している。 */
export function getTiltedLiquidShape(
  box: GlassBox,
  runs: readonly TiltedLiquidRun[],
  amount: number,
  angleDeg: number,
): TiltedLiquidShape {
  const interior = getInterior(box);
  const slotArea = getSlotArea(box);
  const down = getDown((angleDeg * Math.PI) / 180);
  const polygons = runs.map((run) => {
    const toSlot = Math.min(run.toSlot, amount);
    if (toSlot <= run.fromSlot) {
      return "";
    }
    const deepLevel = getLevelForVolume(interior, down, run.fromSlot, slotArea);
    const shallowLevel = getLevelForVolume(interior, down, toSlot, slotArea);
    const band = clipByLevel(
      clipByLevel(interior, down, shallowLevel, true),
      down,
      deepLevel,
      false,
    );
    return toPoints(band);
  });
  if (amount <= 0) {
    return { polygons, surface: "" };
  }
  const surfaceLevel = getLevelForVolume(interior, down, amount, slotArea);
  // 液面の深さで内側を切り、その縁のうち液面の上にある辺だけを線にする。
  const surfacePoints = clipByLevel(interior, down, surfaceLevel, true).filter(
    (point) => Math.abs(depthOf(point, down) - surfaceLevel) < 0.01,
  );
  return { polygons, surface: toPoints(surfacePoints) };
}
