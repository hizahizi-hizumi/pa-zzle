import { type Ref, useId } from "react";
import { BAR_GLASS } from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";
import { getBarLiquid } from "@/games/water-sort/ui/ideas/bar/bar-liquids";
import type { TiltedLiquidRun } from "@/games/water-sort/ui/ideas/bar/tilted-glass";

type TiltedLiquidProps = {
  width: number;
  height: number;
  runs: readonly TiltedLiquidRun[];
  /** 描くたびに、層の形と液面の線を書き換える要素を受け取る。 */
  polygonRefs: (index: number) => Ref<SVGPolygonElement>;
  surfaceRef: Ref<SVGPolylineElement>;
};

/** 傾けたグラスの中で、液面を水平に保って寄る液。 */
export function TiltedLiquid({
  width,
  height,
  runs,
  polygonRefs,
  surfaceRef,
}: TiltedLiquidProps) {
  const id = useId();
  const left = width * BAR_GLASS.wallInset;
  const right = width - left;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        {runs.map((run, index) => {
          const { color, edge, core } = getBarLiquid(run.colorIndex);
          return (
            <linearGradient
              key={`${run.fromSlot}-${run.colorIndex}`}
              id={`${id}-${index}`}
              gradientUnits="userSpaceOnUse"
              x1={left}
              y1="0"
              x2={right}
              y2="0"
            >
              <stop offset="0" stopColor={edge} />
              <stop offset="0.2" stopColor={color} />
              <stop offset="0.42" stopColor={core} stopOpacity="0.9" />
              <stop offset="0.7" stopColor={color} />
              <stop offset="1" stopColor={edge} />
            </linearGradient>
          );
        })}
      </defs>
      {runs.map((run, index) => (
        <polygon
          key={`${run.fromSlot}-${run.colorIndex}`}
          ref={polygonRefs(index)}
          fill={`url(#${id}-${index})`}
        />
      ))}
      <polyline
        ref={surfaceRef}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.2"
      />
    </svg>
  );
}
