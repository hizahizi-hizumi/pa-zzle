type Point = { x: number; y: number };
type EdgeKnob = "tab" | "blank";

export const JIGSAW_STRIP_CELL_COUNT = 5;

/**
 * 凸凹の大きさ。頭の半径はマスの辺に対する比で決め、根元の丸みと頭の中心までの距離は
 * 戻るアイコン（lucide の puzzle と同じ比率）にそろえる。
 */
const KNOB_HEAD_RATIO = 0.15;
const KNOB_FILLET_TO_HEAD = 0.4;
const KNOB_CENTER_TO_HEAD = 1.13;

/** 上の辺の凸凹。左から凸と凹を交互に置く。 */
const topEdgeKnobs = [
  "tab",
  "blank",
  "tab",
  "blank",
  "tab",
] as const satisfies readonly EdgeKnob[];

export type JigsawStrip = {
  width: number;
  height: number;
  /** 左から順の各マスの輪郭。 */
  cells: readonly string[];
  /** 隣り合うマスの境目。継ぎ目の凸は埋まっていく向き（右）にそろえる。 */
  seams: readonly string[];
};

function formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function formatPoint({ x, y }: Point): string {
  return `${formatNumber(x)} ${formatNumber(y)}`;
}

function add(point: Point, direction: Point, distance: number): Point {
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance,
  };
}

/**
 * 辺 from→to の中点に置く凸凹を、辺の始点の直後から終点の直前までのパスとして返す。
 * 輪郭は時計回りに辿るので、辺の進む向きの左手側が外側になる。凸は外側へ、凹は内側へ出す。
 */
function knobPath(
  from: Point,
  to: Point,
  knob: EdgeKnob,
  headRadius: number,
): string {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const along = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const outward = { x: along.y, y: -along.x };
  const sign = knob === "tab" ? 1 : -1;
  const filletRadius = headRadius * KNOB_FILLET_TO_HEAD;
  const centerDistance = headRadius * KNOB_CENTER_TO_HEAD;

  const middle = add(from, along, length / 2);
  const headCenter = add(middle, outward, centerDistance * sign);
  // 根元の丸みの円は、辺と頭の円の両方に接する。
  const filletOffset = Math.sqrt(
    (headRadius + filletRadius) ** 2 - (centerDistance - filletRadius) ** 2,
  );
  const neckStart = add(middle, along, -filletOffset);
  const neckEnd = add(middle, along, filletOffset);
  const toHead = (filletCenter: Point) =>
    add(
      filletCenter,
      {
        x: (headCenter.x - filletCenter.x) / (headRadius + filletRadius),
        y: (headCenter.y - filletCenter.y) / (headRadius + filletRadius),
      },
      filletRadius,
    );
  const headStart = toHead(add(neckStart, outward, filletRadius * sign));
  const headEnd = toHead(add(neckEnd, outward, filletRadius * sign));
  const filletSweep = knob === "tab" ? 0 : 1;
  const headSweep = knob === "tab" ? 1 : 0;

  return [
    `L${formatPoint(neckStart)}`,
    `A${formatNumber(filletRadius)} ${formatNumber(filletRadius)} 0 0 ${filletSweep} ${formatPoint(headStart)}`,
    `A${formatNumber(headRadius)} ${formatNumber(headRadius)} 0 1 ${headSweep} ${formatPoint(headEnd)}`,
    `A${formatNumber(filletRadius)} ${formatNumber(filletRadius)} 0 0 ${filletSweep} ${formatPoint(neckEnd)}`,
  ].join("");
}

/** 1マスの辺の長さ `cellSize` の帯を、1単位=1pxの座標で組み立てる。 */
export function createJigsawStrip(cellSize: number): JigsawStrip {
  const headRadius = cellSize * KNOB_HEAD_RATIO;
  // 上の辺の凸が収まるよう、帯の本体を凸の突き出しの分だけ下げる。
  const top = Math.ceil(headRadius * (KNOB_CENTER_TO_HEAD + 1));
  const bottom = top + cellSize;
  const lastIndex = JIGSAW_STRIP_CELL_COUNT - 1;

  const cells = topEdgeKnobs.map((topKnob, index) => {
    const left = index * cellSize;
    const right = left + cellSize;
    const topLeft = { x: left, y: top };
    const topRight = { x: right, y: top };
    const bottomRight = { x: right, y: bottom };
    const bottomLeft = { x: left, y: bottom };
    return [
      `M${formatPoint(topLeft)}`,
      knobPath(topLeft, topRight, topKnob, headRadius),
      `L${formatPoint(topRight)}`,
      index < lastIndex
        ? knobPath(topRight, bottomRight, "tab", headRadius)
        : "",
      `L${formatPoint(bottomRight)}`,
      `L${formatPoint(bottomLeft)}`,
      index > 0 ? knobPath(bottomLeft, topLeft, "blank", headRadius) : "",
      "Z",
    ].join("");
  });

  const seams = Array.from({ length: lastIndex }, (_, index) => {
    const x = (index + 1) * cellSize;
    const seamTop = { x, y: top };
    const seamBottom = { x, y: bottom };
    return `M${formatPoint(seamTop)}${knobPath(seamTop, seamBottom, "tab", headRadius)}L${formatPoint(seamBottom)}`;
  });

  return {
    width: cellSize * JIGSAW_STRIP_CELL_COUNT,
    height: bottom,
    cells,
    seams,
  };
}
