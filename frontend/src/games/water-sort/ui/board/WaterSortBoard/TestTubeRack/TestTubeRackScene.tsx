import { useId } from "react";

import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WATER_SORT_RACK_OVERHANG_RATIO } from "@/games/water-sort/ui/board/rack-extent";
import { getReagentCausticColor } from "@/games/water-sort/ui/board/test-tube/reagent";
import type { RackLayout } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/rack-layout";

type TestTubeRackSceneProps = {
  layout: RackLayout;
  state: WaterSortState;
};

const sceneColorClassName =
  "[--wood-top:#e6c48f] [--wood-face-a:#d3a265] [--wood-face-b:#b47c40] [--wood-edge:#f6dcae] [--wood-shadow:rgba(70,40,10,0.45)] " +
  "[--bench-back:#33373a] [--bench-front:#15171a] [--bench-nose:#0f1012] [--bench-nose-light:#6b7176] [--bench-glare:rgba(255,253,240,0.16)] " +
  "[--cabinet:#d9e1da] [--cabinet-seam:rgba(70,85,75,0.28)] [--cabinet-handle:#a9b2b4] " +
  "dark:[--wood-top:#8f6c47] dark:[--wood-face-a:#7d5a38] dark:[--wood-face-b:#5c3f25] dark:[--wood-edge:#b08a5f] dark:[--wood-shadow:rgba(0,0,0,0.55)] " +
  "dark:[--bench-back:#202427] dark:[--bench-front:#0c0d0f] dark:[--bench-nose:#08090a] dark:[--bench-nose-light:#4a5257] dark:[--bench-glare:rgba(200,225,255,0.11)] " +
  "dark:[--cabinet:#161d21] dark:[--cabinet-seam:rgba(0,0,0,0.5)] dark:[--cabinet-handle:#4d575c]";

export function TestTubeRackScene({ layout, state }: TestTubeRackSceneProps) {
  const ids = {
    grain: useId(),
    speckle: useId(),
    face: useId(),
    bench: useId(),
    nose: useId(),
    caustic: useId(),
    underNose: useId(),
    glare: useId(),
  };
  const { tubeWidth: w, tubeHeight: h, rows } = layout;
  const lastRow = rows[rows.length - 1];
  const firstRow = rows[0];
  if (!lastRow || !firstRow) {
    return null;
  }

  const rackLeft = layout.left - w * WATER_SORT_RACK_OVERHANG_RATIO;
  const rackRight = layout.right + w * WATER_SORT_RACK_OVERHANG_RATIO;
  const postWidth = Math.max(6, w * 0.22);
  const plankFace = h * 0.065;
  const plankTop = h * 0.03;
  const contactY = lastRow.bottom + plankFace;
  const benchBack = contactY - h * 0.5;
  const benchFront = contactY + h * 0.1;
  const noseHeight = Math.max(8, h * 0.07);
  const cabinetTop = benchFront + noseHeight;
  const sceneLeft = -layout.width;
  const sceneWidth = layout.width * 3;
  const doorCount = layout.width > 640 ? 5 : 3;
  const doorWidth = layout.width / doorCount;

  return (
    <svg
      width={layout.width}
      height={layout.height}
      className={`absolute top-0 left-0 overflow-visible ${sceneColorClassName}`}
      aria-hidden="true"
    >
      <defs>
        <filter id={ids.grain} x="0" y="0" width="1" height="1">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.32"
            numOctaves="2"
            seed="3"
          />
          <feColorMatrix values="0 0 0 0 0.32  0 0 0 0 0.18  0 0 0 0 0.06  0 0 0 1.4 -0.55" />
          <feComposite in2="SourceGraphic" operator="in" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode />
          </feMerge>
        </filter>
        <filter id={ids.speckle} x="0" y="0" width="1" height="1">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="1"
            seed="11"
          />
          <feColorMatrix values="0 0 0 0 0.75  0 0 0 0 0.78  0 0 0 0 0.8  0 0 0 0.9 -0.66" />
          <feComposite in2="SourceGraphic" operator="in" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode />
          </feMerge>
        </filter>
        <linearGradient id={ids.face} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--wood-face-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--wood-face-b)" }} />
        </linearGradient>
        <linearGradient id={ids.bench} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--bench-back)" }} />
          <stop offset="1" style={{ stopColor: "var(--bench-front)" }} />
        </linearGradient>
        <linearGradient id={ids.nose} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--bench-nose-light)" }} />
          <stop offset="0.18" style={{ stopColor: "var(--bench-nose)" }} />
          <stop offset="1" style={{ stopColor: "var(--bench-nose)" }} />
        </linearGradient>
        <linearGradient id={ids.underNose} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="black" stopOpacity="0.32" />
          <stop offset="1" stopColor="black" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ids.glare}>
          <stop offset="0" style={{ stopColor: "var(--bench-glare)" }} />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.caustic}>
          <stop offset="0" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 実験台の天板（耐薬品の黒い樹脂） */}
      <rect
        x={sceneLeft}
        y={benchBack - 3}
        width={sceneWidth}
        height={3}
        fill="rgba(0,0,0,0.18)"
      />
      <rect
        x={sceneLeft}
        y={benchBack}
        width={sceneWidth}
        height={benchFront - benchBack}
        fill={`url(#${ids.bench})`}
        filter={`url(#${ids.speckle})`}
      />
      {/* 天板に映る窓の光 */}
      <ellipse
        cx={layout.width * 0.32}
        cy={benchBack + (benchFront - benchBack) * 0.35}
        rx={layout.width * 0.55}
        ry={(benchFront - benchBack) * 0.3}
        fill={`url(#${ids.glare})`}
      />
      {/* 天板に映る試験管立て */}
      <rect
        x={rackLeft}
        y={contactY}
        width={rackRight - rackLeft}
        height={h * 0.06}
        fill="var(--wood-face-b)"
        opacity="0.22"
        style={{ filter: "blur(2px)" }}
      />
      {/* 色水を透った光が天板に落ちる */}
      {layout.tubes.map((tube) => {
        const colorIndex = state[tube.bottleIndex]?.[0];
        if (colorIndex === undefined || tube.top + tube.height < lastRow.top) {
          return null;
        }
        return (
          <ellipse
            key={`bench-caustic-${tube.bottleIndex}`}
            cx={tube.left + tube.width / 2}
            cy={contactY + h * 0.045}
            rx={tube.width * 0.42}
            ry={h * 0.03}
            fill={getReagentCausticColor(colorIndex)}
            opacity="0.55"
            style={{ filter: "blur(3px)" }}
          />
        );
      })}
      {/* 天板の前の縁 */}
      <rect
        x={sceneLeft}
        y={benchFront}
        width={sceneWidth}
        height={noseHeight}
        fill={`url(#${ids.nose})`}
      />
      {/* 流しの戸棚 */}
      <rect
        x={sceneLeft}
        y={cabinetTop}
        width={sceneWidth}
        height={3000}
        fill="var(--cabinet)"
      />
      <rect
        x={sceneLeft}
        y={cabinetTop}
        width={sceneWidth}
        height={18}
        fill={`url(#${ids.underNose})`}
      />
      {Array.from({ length: doorCount + 1 }, (_, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: 戸の継ぎ目は並びの位置だけで決まる。
          key={index}
          x={index * doorWidth - 0.5}
          y={cabinetTop + 6}
          width={1}
          height={3000}
          fill="var(--cabinet-seam)"
        />
      ))}
      {Array.from({ length: doorCount }, (_, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: 取っ手は戸の並びの位置だけで決まる。
          key={index}
          x={(index + 0.5) * doorWidth - 14}
          y={cabinetTop + 12}
          width={28}
          height={5}
          rx={2.5}
          fill="var(--cabinet-handle)"
        />
      ))}
      {/* 試験管立ての側板 */}
      {[rackLeft, rackRight - postWidth].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={firstRow.top + h * 0.1}
            width={postWidth}
            height={contactY - firstRow.top - h * 0.1}
            rx={Math.min(3, postWidth / 3)}
            fill={`url(#${ids.face})`}
            filter={`url(#${ids.grain})`}
          />
          <rect
            x={x + 1}
            y={firstRow.top + h * 0.1 + 1}
            width={1.2}
            height={contactY - firstRow.top - h * 0.1 - 2}
            fill="var(--wood-edge)"
            opacity="0.7"
          />
        </g>
      ))}

      {rows.map((row) => {
        const holedTop = row.top + h * 0.15;
        const baseTop = row.bottom - plankTop;
        const plankLeft = rackLeft + postWidth * 0.6;
        const plankWidth = rackRight - rackLeft - postWidth * 1.2;
        const rowTubes = layout.tubes.filter(
          (tube) => Math.abs(tube.top - row.top) < h / 2,
        );
        return (
          <g key={row.top}>
            {/* 穴のあいた上の板 */}
            <rect
              x={plankLeft}
              y={holedTop}
              width={plankWidth}
              height={plankTop}
              fill="var(--wood-top)"
            />
            {layout.columnLefts.map((left) => (
              <ellipse
                key={`hole-${left}`}
                cx={left + w / 2}
                cy={holedTop + plankTop * 0.55}
                rx={w * 0.45}
                ry={plankTop * 0.42}
                fill="rgba(45,25,8,0.75)"
              />
            ))}
            <rect
              x={plankLeft}
              y={holedTop + plankTop}
              width={plankWidth}
              height={plankFace}
              fill={`url(#${ids.face})`}
              filter={`url(#${ids.grain})`}
            />
            <rect
              x={plankLeft}
              y={holedTop + plankTop}
              width={plankWidth}
              height={0.8}
              fill="var(--wood-edge)"
            />
            <rect
              x={plankLeft}
              y={holedTop + plankTop + plankFace}
              width={plankWidth}
              height={2.5}
              fill="var(--wood-shadow)"
              opacity="0.5"
            />
            {/* 試験管を受ける下の板 */}
            <rect
              x={plankLeft}
              y={baseTop}
              width={plankWidth}
              height={plankTop}
              fill="var(--wood-top)"
            />
            {rowTubes.map((tube) => {
              const colorIndex = state[tube.bottleIndex]?.[0];
              return (
                <g key={`seat-${tube.bottleIndex}`}>
                  <ellipse
                    cx={tube.left + tube.width / 2 + w * 0.06}
                    cy={baseTop + plankTop * 0.5}
                    rx={w * 0.46}
                    ry={plankTop * 0.5}
                    fill="var(--wood-shadow)"
                    style={{ filter: "blur(1.5px)" }}
                  />
                  {colorIndex !== undefined && (
                    <ellipse
                      cx={tube.left + tube.width / 2}
                      cy={baseTop + plankTop + plankFace * 0.35}
                      rx={tube.width * 0.38}
                      ry={plankFace * 0.45}
                      fill={getReagentCausticColor(colorIndex)}
                      opacity="0.35"
                      style={{ filter: "blur(2.5px)" }}
                    />
                  )}
                </g>
              );
            })}
            <rect
              x={plankLeft}
              y={row.bottom}
              width={plankWidth}
              height={plankFace}
              fill={`url(#${ids.face})`}
              filter={`url(#${ids.grain})`}
            />
            {rowTubes.map((tube) => {
              const colorIndex = state[tube.bottleIndex]?.[0];
              return colorIndex === undefined ? null : (
                <ellipse
                  key={`glow-${tube.bottleIndex}`}
                  cx={tube.left + tube.width / 2}
                  cy={row.bottom + plankFace * 0.3}
                  rx={tube.width * 0.34}
                  ry={plankFace * 0.5}
                  fill={`url(#${ids.caustic})`}
                  style={{
                    filter: "blur(2px)",
                    opacity: 0.35,
                    mixBlendMode: "overlay",
                  }}
                />
              );
            })}
            <rect
              x={plankLeft}
              y={row.bottom}
              width={plankWidth}
              height={0.8}
              fill="var(--wood-edge)"
            />
          </g>
        );
      })}
    </svg>
  );
}
