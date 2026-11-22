import { useId, useRef } from "react";

import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  getSourcePose,
  type PourPath,
} from "@/games/water-sort/ui/board/pour/pour-path";
import {
  getTiltedLiquid,
  getTiltedLiquidRuns,
  TUBE_INTERIOR_POINTS,
  type TubePoint,
  type TubeSegment,
} from "@/games/water-sort/ui/board/pour/tilted-liquid";
import { useAnimationFrame } from "@/games/water-sort/ui/board/pour/use-animation-frame";
import {
  getReagentFill,
  getReagentSurfaceShade,
} from "@/games/water-sort/ui/board/test-tube/reagent";
import {
  TUBE_INNER,
  TUBE_VIEW_BOX,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

type TiltedLiquidProps = {
  contents: WaterSortBottle;
  path: PourPath;
  getElapsedMs: () => number;
};

const VIEW_WIDTH = 36;
const INNER_WIDTH = TUBE_INNER.right - TUBE_INNER.left;
/** 液面のすぐ下に光る線を置く深さ（px）。立てた試験管の液面の光と同じ所。 */
const SURFACE_HIGHLIGHT_DEPTH_PX = 1.8;

const interiorPoints = TUBE_INTERIOR_POINTS.map(([x, y]) => `${x},${y}`).join(
  " ",
);

/** 層の塗りは管の内側の幅に掛けるので、点を内側の箱に対する割合にする。 */
function toClipPath(points: readonly TubePoint[]): string {
  if (points.length < 3) {
    return "polygon(0 0, 0 0, 0 0)";
  }
  const values = points.map(
    ([x, y]) =>
      `${(((x - TUBE_INNER.left) / INNER_WIDTH) * 100).toFixed(3)}% ${y.toFixed(3)}%`,
  );
  return `polygon(${values.join(", ")})`;
}

function setLine(
  element: SVGLineElement | null,
  segment: TubeSegment | null,
  shift: TubePoint = [0, 0],
) {
  if (!element) {
    return;
  }
  if (!segment) {
    element.setAttribute("visibility", "hidden");
    return;
  }
  const [[x1, y1], [x2, y2]] = segment;
  element.setAttribute("visibility", "visible");
  element.setAttribute("x1", String(x1 + shift[0]));
  element.setAttribute("y1", String(y1 + shift[1]));
  element.setAttribute("x2", String(x2 + shift[0]));
  element.setAttribute("y2", String(y2 + shift[1]));
}

/**
 * 傾けた試験管の中の液。液は低い側に寄り、液面も層の境目も水平に保つ。
 * 試験管と一緒に傾く座標で、層の形を毎フレーム求め直す。
 */
export function TiltedLiquid({
  contents,
  path,
  getElapsedMs,
}: TiltedLiquidProps) {
  const clipId = useId();
  const runs = getTiltedLiquidRuns(contents);
  const layerRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const boundaryRefs = useRef<Array<SVGLineElement | null>>([]);
  const surfaceShadeRef = useRef<SVGLineElement>(null);
  const surfaceHighlightRef = useRef<SVGLineElement>(null);

  useAnimationFrame(function drawTiltedLiquid() {
    const pose = getSourcePose(path, getElapsedMs());
    const liquid = getTiltedLiquid(runs, pose.amount, pose.tiltDeg);
    liquid.layers.forEach((layer, index) => {
      const element = layerRefs.current[index];
      if (element) {
        element.style.clipPath = toClipPath(layer.points);
      }
    });
    boundaryRefs.current.forEach((element, index) => {
      setLine(element, liquid.boundaries[index] ?? null);
    });
    const top = liquid.layers.findLast((layer) => layer.points.length > 0);
    surfaceShadeRef.current?.setAttribute(
      "stroke",
      `rgba(20,30,35,${top ? getReagentSurfaceShade(top.colorIndex) : 0})`,
    );
    setLine(surfaceShadeRef.current, liquid.surface);
    const radian = (pose.tiltDeg * Math.PI) / 180;
    const unitPerPx = VIEW_WIDTH / path.source.width;
    const depth = SURFACE_HIGHLIGHT_DEPTH_PX * unitPerPx;
    setLine(surfaceHighlightRef.current, liquid.surface, [
      Math.sin(radian) * depth,
      Math.cos(radian) * depth,
    ]);
  });

  return (
    // 傾けると液が首まで寄るので、立てた液を収める箱の切り抜きから出す。
    // 注ぎ元は transform で動かすので、fixed の基準は試験管の箱になる。
    <span aria-hidden="true" className="fixed inset-0">
      {runs.map((run, index) => (
        <span
          key={`${run.fromSlot}-${run.colorIndex}`}
          ref={(element) => {
            layerRefs.current[index] = element;
          }}
          className="absolute inset-y-0"
          style={{
            left: `${(TUBE_INNER.left / VIEW_WIDTH) * 100}%`,
            right: `${((VIEW_WIDTH - TUBE_INNER.right) / VIEW_WIDTH) * 100}%`,
            clipPath: toClipPath([]),
            ...getReagentFill(run.colorIndex),
          }}
        />
      ))}
      <svg
        viewBox={TUBE_VIEW_BOX}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <polygon points={interiorPoints} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {runs.slice(1).map((run, index) => (
            <line
              key={`${run.fromSlot}-${run.colorIndex}`}
              ref={(element) => {
                boundaryRefs.current[index] = element;
              }}
              visibility="hidden"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            ref={surfaceHighlightRef}
            visibility="hidden"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
          <line
            ref={surfaceShadeRef}
            visibility="hidden"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </span>
  );
}
