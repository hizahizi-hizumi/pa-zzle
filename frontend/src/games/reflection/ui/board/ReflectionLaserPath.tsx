import type {
  ReflectionEntry,
  ReflectionLaserTrace,
} from "@/games/reflection/puzzle/laser";
import {
  getReflectionLaserEnd,
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
/** 入口の印（光路に直交する短い太線）の半分の長さと太さ。 */
const ENTRY_MARK_HALF_LENGTH = 0.2;
const ENTRY_MARK_WIDTH = 0.1;
/** 出口の矢印。盤面との隙間（マスの0.2）に収まる大きさにする。 */
const ARROW_LENGTH = 0.17;
const ARROW_HALF_WIDTH = 0.11;

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

/** 入口の印。光路の端から太さの半分だけ盤面側へ寄せ、外周ヒント（一致の地）に重ねない。 */
function getEntryMarkPoints(
  end: ReflectionPoint,
  { dx, dy }: { dx: number; dy: number },
): string {
  const center = {
    x: end.x - (dx * ENTRY_MARK_WIDTH) / 2,
    y: end.y - (dy * ENTRY_MARK_WIDTH) / 2,
  };
  return formatPoints([
    {
      x: center.x - dy * ENTRY_MARK_HALF_LENGTH,
      y: center.y + dx * ENTRY_MARK_HALF_LENGTH,
    },
    {
      x: center.x + dy * ENTRY_MARK_HALF_LENGTH,
      y: center.y - dx * ENTRY_MARK_HALF_LENGTH,
    },
  ]);
}

/**
 * 1本の光路。座標はマス1辺を1とする図の単位。
 * 両端は外周ヒントの縁ではなく、外周ヒントと盤面の間の隙間に置き、外周ヒント（一致の地）に重ねない。
 * 入った位置（押した外周ヒントの前）に光路と直交する短い太線、外へ出た位置に外向きの矢印を置き、向きを示す。
 * 反射は入った位置へ戻って出るので矢印だけ、吸収は入口の印だけになる。
 */
export function ReflectionLaserPath({
  size,
  entry,
  trace,
  clearStep,
}: ReflectionLaserPathProps) {
  const points = getReflectionLaserPoints(size, entry, trace);
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
        <polyline
          data-laser-entry=""
          points={getEntryMarkPoints(
            getReflectionLaserEnd(size, entry),
            getReflectionOutwardVector(entry.side),
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={ENTRY_MARK_WIDTH}
          strokeLinecap="round"
        />
      )}
      {exit ? (
        <polygon
          data-laser-arrow=""
          points={getArrowPoints(
            getReflectionLaserEnd(size, exit),
            getReflectionOutwardVector(exit.side),
          )}
          fill="currentColor"
        />
      ) : null}
    </g>
  );
}
