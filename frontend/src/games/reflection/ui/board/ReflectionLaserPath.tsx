import type {
  ReflectionEntry,
  ReflectionLaserTrace,
} from "@/games/reflection/puzzle/laser";
import {
  getReflectionClueAnchor,
  getReflectionLaserPoints,
  getReflectionOutwardVector,
  type ReflectionPoint,
} from "@/games/reflection/ui/board/board-geometry";

type ReflectionLaserPathProps = {
  size: number;
  entry: ReflectionEntry;
  trace: ReflectionLaserTrace;
  /** 完成演出で線を伸ばす順番。 */
  clearStep?: number;
};

const LASER_WIDTH = 0.075;
const ENTRY_DOT_RADIUS = 0.09;
const ARROW_LENGTH = 0.26;
const ARROW_HALF_WIDTH = 0.15;

function formatPoints(points: readonly ReflectionPoint[]): string {
  return points.map(({ x, y }) => `${x},${y}`).join(" ");
}

function getArrowPoints(
  tip: ReflectionPoint,
  { dx, dy }: { dx: number; dy: number },
): string {
  const base = { x: tip.x - dx * ARROW_LENGTH, y: tip.y - dy * ARROW_LENGTH };
  return formatPoints([
    tip,
    { x: base.x - dy * ARROW_HALF_WIDTH, y: base.y + dx * ARROW_HALF_WIDTH },
    { x: base.x + dy * ARROW_HALF_WIDTH, y: base.y - dx * ARROW_HALF_WIDTH },
  ]);
}

/**
 * 1本の光路。入った位置に点、外へ出た位置に外向きの矢印を置く。反射は入った位置の矢印だけになる。
 * 座標はマス1辺を1とする図の単位。
 */
export function ReflectionLaserPath({
  size,
  entry,
  trace,
  clearStep,
}: ReflectionLaserPathProps) {
  const points = getReflectionLaserPoints(size, entry, trace);
  const start = getReflectionClueAnchor(size, entry);
  const { exit } = trace;

  return (
    <g data-clear-light-step={clearStep}>
      <polyline
        data-laser-line=""
        points={formatPoints(points)}
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={LASER_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {trace.outcome === "reflect" ? null : (
        <circle
          cx={start.x}
          cy={start.y}
          r={ENTRY_DOT_RADIUS}
          fill="currentColor"
        />
      )}
      {exit ? (
        <polygon
          data-laser-arrow=""
          points={getArrowPoints(
            getReflectionClueAnchor(size, exit),
            getReflectionOutwardVector(exit.side),
          )}
          fill="currentColor"
        />
      ) : null}
    </g>
  );
}
