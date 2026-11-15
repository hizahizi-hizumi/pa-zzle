import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  GHOST_EXTRA_WIDTH,
  POST_DISTANCE,
  POST_RADIUS,
  REMOVAL_EXTRA_WIDTH,
} from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import type {
  BridgesBlockedAttempt,
  PlankLayout,
} from "@/games/bridges/ui/board/BridgesFigure/figure-contract";
import {
  type BoardPoint,
  type BoardSegment,
  type BoardView,
  getBridgeLineOffsets,
  getEdgeViewSegment,
} from "@/games/bridges/ui/board/board-geometry";

/**
 * マスの大きい盤面の板と、マスの小さい盤面（`compact`）の板。マスの小さい盤面では横木が点の並びにつぶれるので刻まず、
 * その分だけ板を太くし、2本の板の間の海も広げる。どちらも寸法はマス幅に比例する。
 */
export const plankLayouts = {
  regular: { single: 0.26, double: 0.18, spacing: 0.3, seams: true },
  compact: { single: 0.3, double: 0.2, spacing: 0.34, seams: false },
} as const satisfies Record<string, PlankLayout>;

export function offsetSegment(
  { start, end }: BoardSegment,
  offset: number,
): BoardSegment {
  const horizontal = start.y === end.y;
  function shift(point: BoardPoint): BoardPoint {
    return horizontal
      ? { x: point.x, y: point.y + offset }
      : { x: point.x + offset, y: point.y };
  }
  return { start: shift(start), end: shift(end) };
}

export function getPlankWidth(count: BridgeCount, layout: PlankLayout): number {
  return count === 2 ? layout.double : layout.single;
}

export function getPlankOffsets(
  count: BridgeCount,
  layout: PlankLayout,
): readonly number[] {
  return getBridgeLineOffsets(count, layout.spacing);
}

export function getFootprintHalfWidth(
  count: BridgeCount,
  layout: PlankLayout,
): number {
  const offsets = getPlankOffsets(count, layout);
  return Math.max(...offsets.map(Math.abs)) + getPlankWidth(count, layout) / 2;
}

/** 両端の島ごとに、板の外側の左右に1本ずつ立てる。 */
export function listPostPoints(
  { start, end }: BoardSegment,
  count: BridgeCount,
  layout: PlankLayout,
): BoardPoint[] {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const along = {
    x: (end.x - start.x) / length,
    y: (end.y - start.y) / length,
  };
  const across = { x: -along.y, y: along.x };
  const side = getFootprintHalfWidth(count, layout) + POST_RADIUS * 0.4;
  return ([0, 1] as const).flatMap((endIndex) => {
    const [origin, direction] = endIndex === 0 ? [start, 1] : [end, -1];
    const base = {
      x: origin.x + along.x * POST_DISTANCE * direction,
      y: origin.y + along.y * POST_DISTANCE * direction,
    };
    return [-1, 1].map((sign) => ({
      x: base.x + across.x * side * sign,
      y: base.y + across.y * side * sign,
    }));
  });
}
/** 辺の橋を回した後の姿の予告が占める幅。チュートリアルの印を、予告の板の影に沿わせるのに使う。 */
export function getGhostBridgeWidth(
  current: BridgeCount,
  compact = false,
): number {
  const layout = compact ? plankLayouts.compact : plankLayouts.regular;
  const next = ((current + 1) % 3) as BridgeCount;
  return next === 0
    ? getFootprintHalfWidth(current, layout) * 2 + REMOVAL_EXTRA_WIDTH
    : getFootprintHalfWidth(next, layout) * 2 + GHOST_EXTRA_WIDTH;
}
/**
 * 阻まれた辺の、押した端の島の中心から、その島に最も近い阻んだ橋の板の手前までの線分。
 * 阻んだ橋が無ければ、辺の全体。
 */
export function getBlockedAttemptSegment(
  view: BoardView,
  { edge, island }: BridgesBlockedAttempt,
  blockingEdges: readonly number[],
  bridges: readonly BridgeCount[],
  layout: PlankLayout,
): BoardSegment {
  const whole = getEdgeViewSegment(view, edge);
  const { from } = getBridgesNetwork(view.board).edges[edge]!;
  const [start, far] =
    island === from ? [whole.start, whole.end] : [whole.end, whole.start];
  const horizontal = start.y === far.y;
  const direction = Math.sign(horizontal ? far.x - start.x : far.y - start.y);
  const stops = blockingEdges.map((blocking) => {
    const line = getEdgeViewSegment(view, blocking).start;
    const position = horizontal ? line.x : line.y;
    return (
      position -
      direction * getFootprintHalfWidth(bridges[blocking] || 1, layout)
    );
  });
  const origin = horizontal ? start.x : start.y;
  const stop =
    stops.length === 0
      ? horizontal
        ? far.x
        : far.y
      : stops.reduce((nearest, position) =>
          Math.abs(position - origin) < Math.abs(nearest - origin)
            ? position
            : nearest,
        );
  return {
    start,
    end: horizontal ? { x: stop, y: start.y } : { x: start.x, y: stop },
  };
}
