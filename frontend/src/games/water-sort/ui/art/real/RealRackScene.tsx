import { useId } from "react";

import {
  getRealReagentCaustic,
  getRealReagentLook,
} from "@/games/water-sort/ui/art/real/real-reagent";
import {
  NOISE_TILE_SIZE,
  SURFACE_GRAIN_URI,
  WOOD_GRAIN_URI,
} from "@/games/water-sort/ui/art/real/real-texture";
import { WATER_SORT_RACK_OVERHANG_RATIO } from "@/games/water-sort/ui/board/rack-extent";
import type { TestTubeRackSceneProps } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/TestTubeRackScene";

const sceneColorClassName =
  "[--wood-top-back:#f1d6a4] [--wood-top-front:#e0bb80] [--wood-face-top:#c08a4c] [--wood-face-bottom:#94612c] [--wood-notch:#a5713f] [--wood-bevel:rgba(255,238,205,0.85)] [--wood-cast:rgba(60,32,8,0.4)] " +
  "[--bench-back:#2a2d2f] [--bench-front:#141618] [--bench-nose:#0d0e0f] [--bench-bevel:rgba(255,255,255,0.22)] [--bench-glare:rgba(232,240,240,0.2)] " +
  "[--wall-occlusion:rgba(30,36,32,0.28)] [--cabinet-top:#7f8a83] [--cabinet-bottom:#97a29a] [--cabinet-gap:rgba(20,26,22,0.6)] [--handle:#c7ccce] " +
  "dark:[--wood-top-back:#a17d52] dark:[--wood-top-front:#8a6842] dark:[--wood-face-top:#6c4c2d] dark:[--wood-face-bottom:#4a321c] dark:[--wood-notch:#3e2914] dark:[--wood-bevel:rgba(255,226,190,0.4)] dark:[--wood-cast:rgba(0,0,0,0.5)] " +
  "dark:[--bench-back:#17191b] dark:[--bench-front:#0a0b0c] dark:[--bench-nose:#060707] dark:[--bench-bevel:rgba(255,255,255,0.1)] dark:[--bench-glare:rgba(200,150,130,0.1)] " +
  "dark:[--wall-occlusion:rgba(0,0,0,0.4)] dark:[--cabinet-top:#15191b] dark:[--cabinet-bottom:#1d2326] dark:[--cabinet-gap:rgba(0,0,0,0.7)] dark:[--handle:#4b5357]";

// 水平な面は、見下ろした角度の分だけ縦につぶれて見える（奥行き × 0.12）。試験管の高さを 1 とした奥行き。
const FORESHORTEN = 0.12;
const BASE_DEPTH = 0.38;
const HOLDER_DEPTH = 0.26;
const BENCH_DEPTH_BEHIND_RACK = 4.2;
const BENCH_DEPTH_BEFORE_RACK = 0.8;
// 板の厚み（正面の高さ）。試験管の高さを 1 とする。
const BOARD_THICKNESS = 0.06;
const BENCH_THICKNESS = 0.07;
/** 試験管のガラスの底（試験管の箱の高さに対する割合）。 */
const TUBE_GLASS_BOTTOM = 0.972;
/** 首を支える切り欠きの板の上の面（試験管の箱の高さに対する割合）。 */
const HOLDER_TOP = 0.15;
/** 切り欠きの奥の壁の位置（首を支える板の上の面の奥から手前への割合）。 */
const NOTCH_BACK_RATIO = 0.5;
/** 液を透った光と影が、光の来る左奥から手前右へずれる量（試験管の幅に対する割合）。 */
const CAST_SHIFT = 0.24;

/**
 * 試験管立てと、それを置く黒い実験台・流しの戸棚。光は左上の奥の窓から来る。
 * 上を向く面は明るく、手前を向く面（板の正面・戸）は暗い。影と、液を透った色の光は手前右へ落ちる。
 * 首を支える板は、前の開いた切り欠きに試験管を差す形なので、試験管の手前を板が横切らない。
 */
export function RealRackScene({ layout, state }: TestTubeRackSceneProps) {
  const ids = {
    woodGrain: useId(),
    postGrain: useId(),
    surfaceGrain: useId(),
    woodTop: useId(),
    woodFace: useId(),
    woodSide: useId(),
    bench: useId(),
    glare: useId(),
    cabinet: useId(),
    underBench: useId(),
    occlusion: useId(),
    reflection: useId(),
    softBlur: useId(),
    falloff: useId(),
  };
  const { tubeWidth: w, tubeHeight: h, rows } = layout;
  const lastRow = rows[rows.length - 1];
  const firstRow = rows[0];
  if (!lastRow || !firstRow) {
    return null;
  }

  const rackLeft = layout.left - w * WATER_SORT_RACK_OVERHANG_RATIO;
  const rackRight = layout.right + w * WATER_SORT_RACK_OVERHANG_RATIO;
  const postWidth = Math.max(6, w * 0.2);
  const boardLeft = rackLeft + postWidth * 0.5;
  const boardWidth = rackRight - rackLeft - postWidth;
  const thickness = h * BOARD_THICKNESS;
  const baseTopHeight = h * BASE_DEPTH * FORESHORTEN;
  const holderTopHeight = h * HOLDER_DEPTH * FORESHORTEN;
  const notchWidth = w * 0.84;

  const rowGeometry = rows.map((row) => {
    const tubeBottom = row.top + h * TUBE_GLASS_BOTTOM;
    const baseBack = tubeBottom - baseTopHeight / 2;
    const baseFront = tubeBottom + baseTopHeight / 2;
    const holderBack = row.top + h * HOLDER_TOP;
    return {
      row,
      tubeBottom,
      baseBack,
      baseFront,
      baseBottom: baseFront + thickness,
      holderBack,
      holderFront: holderBack + holderTopHeight,
      holderBottom: holderBack + holderTopHeight + thickness,
      tubes: layout.tubes.filter(
        (tube) => Math.abs(tube.top - row.top) < h / 2,
      ),
    };
  });
  const lastGeometry = rowGeometry[rowGeometry.length - 1];
  if (!lastGeometry) {
    return null;
  }
  const contactY = lastGeometry.baseBottom;
  const benchBack = contactY - h * BENCH_DEPTH_BEHIND_RACK * FORESHORTEN;
  const benchFront = contactY + h * BENCH_DEPTH_BEFORE_RACK * FORESHORTEN;
  const noseHeight = Math.max(8, h * BENCH_THICKNESS);
  const cabinetTop = benchFront + noseHeight;
  const postTop = firstRow.top + h * 0.08;
  const postTopFace = postWidth * 0.9 * FORESHORTEN * 4;
  const sceneLeft = -layout.width;
  const sceneWidth = layout.width * 3;
  const doorCount = layout.width > 640 ? 5 : 3;
  const doorWidth = layout.width / doorCount;

  function woodBoard(
    key: string,
    back: number,
    front: number,
    bottom: number,
    notches: readonly number[],
  ) {
    const notchBack = back + (front - back) * NOTCH_BACK_RATIO;
    const notchPath = notches
      .map(
        (center) =>
          `M${center - notchWidth / 2} ${notchBack} H${center + notchWidth / 2} V${bottom + 0.5} H${center - notchWidth / 2} Z`,
      )
      .join(" ");
    const boardPath = `M${boardLeft} ${back} H${boardLeft + boardWidth} V${bottom} H${boardLeft} Z ${notchPath}`;
    return (
      <g key={key}>
        {notches.map((center) => (
          // 切り欠きの奥の壁。手前を向き、板の陰になる。
          <rect
            key={`notch-${center}`}
            x={center - notchWidth / 2}
            y={notchBack}
            width={notchWidth}
            height={thickness}
            fill="var(--wood-notch)"
          />
        ))}
        <clipPath id={`${ids.woodGrain}-${key}`}>
          <path d={boardPath} clipRule="evenodd" />
        </clipPath>
        <g clipPath={`url(#${ids.woodGrain}-${key})`}>
          <rect
            x={boardLeft}
            y={back}
            width={boardWidth}
            height={front - back}
            fill={`url(#${ids.woodTop})`}
          />
          <rect
            x={boardLeft}
            y={front}
            width={boardWidth}
            height={bottom - front}
            fill={`url(#${ids.woodFace})`}
          />
          <rect
            x={boardLeft}
            y={back}
            width={boardWidth}
            height={bottom - back}
            fill={`url(#${ids.woodGrain})`}
            style={{ mixBlendMode: "overlay" }}
            opacity="0.6"
          />
          <rect
            x={boardLeft}
            y={back}
            width={boardWidth}
            height={bottom - back}
            fill={`url(#${ids.falloff})`}
          />
          <rect
            x={boardLeft}
            y={front - 0.4}
            width={boardWidth}
            height={1}
            fill="var(--wood-bevel)"
          />
        </g>
      </g>
    );
  }

  return (
    <svg
      width={layout.width}
      height={layout.height}
      className={`absolute top-0 left-0 overflow-visible ${sceneColorClassName}`}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={ids.woodGrain}
          patternUnits="userSpaceOnUse"
          width={NOISE_TILE_SIZE}
          height={NOISE_TILE_SIZE}
        >
          <image
            href={WOOD_GRAIN_URI}
            width={NOISE_TILE_SIZE}
            height={NOISE_TILE_SIZE}
          />
        </pattern>
        <pattern
          id={ids.postGrain}
          patternUnits="userSpaceOnUse"
          width={NOISE_TILE_SIZE}
          height={NOISE_TILE_SIZE}
          // 柱の木目は、繊維が縦に通る。
          patternTransform="rotate(90)"
        >
          <image
            href={WOOD_GRAIN_URI}
            width={NOISE_TILE_SIZE}
            height={NOISE_TILE_SIZE}
          />
        </pattern>
        <pattern
          id={ids.surfaceGrain}
          patternUnits="userSpaceOnUse"
          width={NOISE_TILE_SIZE}
          height={NOISE_TILE_SIZE}
        >
          <image
            href={SURFACE_GRAIN_URI}
            width={NOISE_TILE_SIZE}
            height={NOISE_TILE_SIZE}
          />
        </pattern>
        <linearGradient id={ids.woodTop} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--wood-top-back)" }} />
          <stop offset="1" style={{ stopColor: "var(--wood-top-front)" }} />
        </linearGradient>
        <linearGradient id={ids.woodFace} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--wood-face-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--wood-face-bottom)" }} />
        </linearGradient>
        <linearGradient id={ids.woodSide} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff1d4" stopOpacity="0.35" />
          <stop offset="0.25" stopColor="#fff1d4" stopOpacity="0" />
          <stop offset="0.8" stopColor="#2a1606" stopOpacity="0" />
          <stop offset="1" stopColor="#2a1606" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={ids.bench} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--bench-back)" }} />
          <stop offset="1" style={{ stopColor: "var(--bench-front)" }} />
        </linearGradient>
        <linearGradient id={ids.glare} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--bench-glare)" }} />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.cabinet} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--cabinet-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--cabinet-bottom)" }} />
        </linearGradient>
        <linearGradient id={ids.underBench} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="black" stopOpacity="0.45" />
          <stop offset="1" stopColor="black" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.occlusion} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: "var(--wall-occlusion)" }} />
          <stop offset="1" stopColor="black" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.reflection} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--wood-face-bottom)" }} />
          <stop offset="1" style={{ stopColor: "var(--wood-face-top)" }} />
        </linearGradient>
        <linearGradient
          id={ids.falloff}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={layout.width}
          y2="0"
        >
          <stop offset="0" stopColor="#fff6e2" stopOpacity="0.14" />
          <stop offset="0.4" stopColor="#fff6e2" stopOpacity="0" />
          <stop offset="1" stopColor="#140a02" stopOpacity="0.2" />
        </linearGradient>
        <filter id={ids.softBlur} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {/* 天板と壁の境の、光の届きにくい隅 */}
      <rect
        x={sceneLeft}
        y={benchBack - 14}
        width={sceneWidth}
        height={14}
        fill={`url(#${ids.occlusion})`}
      />
      {/* 実験台の天板（耐薬品の黒い樹脂） */}
      <rect
        x={sceneLeft}
        y={benchBack}
        width={sceneWidth}
        height={benchFront - benchBack}
        fill={`url(#${ids.bench})`}
      />
      <rect
        x={sceneLeft}
        y={benchBack}
        width={sceneWidth}
        height={benchFront - benchBack + noseHeight}
        fill={`url(#${ids.surfaceGrain})`}
        style={{ mixBlendMode: "overlay" }}
        opacity="0.35"
      />
      {/* 天板に映る窓（左上の奥）。つやのある面に、ぼけた縦長の光として映り、窓の縦の桟の所で切れる。 */}
      {[
        [0.02, 0.2],
        [0.23, 0.44],
      ].map(([from, to]) => (
        <rect
          key={from}
          x={layout.width * (from ?? 0)}
          y={benchBack}
          width={layout.width * ((to ?? 0) - (from ?? 0))}
          height={(contactY - benchBack) * 0.9}
          fill={`url(#${ids.glare})`}
          filter={`url(#${ids.softBlur})`}
        />
      ))}
      {/* 天板に映る試験管立ての正面（上下が逆さに、ぼけて） */}
      <rect
        x={boardLeft}
        y={contactY}
        width={boardWidth}
        height={Math.min(thickness, benchFront - contactY)}
        fill={`url(#${ids.reflection})`}
        opacity="0.28"
        filter={`url(#${ids.softBlur})`}
      />
      {/* 天板に落ちる試験管立ての影（手前右へ） */}
      <path
        d={`M${rackLeft + w * 0.3} ${contactY} H${rackRight + w * 0.3} L${rackRight + w * 0.55} ${benchFront} H${rackLeft + w * 0.55} Z`}
        fill="black"
        opacity="0.3"
        filter={`url(#${ids.softBlur})`}
      />
      {/* 天板の前の縁 */}
      <rect
        x={sceneLeft}
        y={benchFront}
        width={sceneWidth}
        height={noseHeight}
        fill="var(--bench-nose)"
      />
      <rect
        x={sceneLeft}
        y={benchFront}
        width={sceneWidth}
        height={1}
        fill="var(--bench-bevel)"
      />
      {/* 流しの戸棚。窓の光を受けない手前向きの面で、天板の下ほど暗い。 */}
      <rect
        x={sceneLeft}
        y={cabinetTop}
        width={sceneWidth}
        height={3000}
        fill={`url(#${ids.cabinet})`}
      />
      <rect
        x={sceneLeft}
        y={cabinetTop}
        width={sceneWidth}
        height={3000}
        fill={`url(#${ids.surfaceGrain})`}
        style={{ mixBlendMode: "overlay" }}
        opacity="0.3"
      />
      <rect
        x={sceneLeft}
        y={cabinetTop}
        width={sceneWidth}
        height={24}
        fill={`url(#${ids.underBench})`}
      />
      {Array.from({ length: doorCount + 1 }, (_, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: 戸の継ぎ目は並びの位置だけで決まる。
          key={index}
          x={index * doorWidth - 1}
          y={cabinetTop + 4}
          width={2}
          height={3000}
          fill="var(--cabinet-gap)"
        />
      ))}
      {Array.from({ length: doorCount }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 取っ手は戸の並びの位置だけで決まる。
        <g key={index}>
          <rect
            x={(index + 0.5) * doorWidth - 15}
            y={cabinetTop + 15}
            width={30}
            height={4}
            rx={2}
            fill="black"
            opacity="0.22"
            filter={`url(#${ids.softBlur})`}
          />
          <rect
            x={(index + 0.5) * doorWidth - 15}
            y={cabinetTop + 12}
            width={30}
            height={5}
            rx={2.5}
            fill="var(--handle)"
          />
          <rect
            x={(index + 0.5) * doorWidth - 13}
            y={cabinetTop + 12.6}
            width={26}
            height={1.2}
            rx={0.6}
            fill="white"
            opacity="0.7"
          />
        </g>
      ))}

      {/* 試験管立ての柱 */}
      {[rackLeft, rackRight - postWidth].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={postTop + postTopFace}
            width={postWidth}
            height={contactY - postTop - postTopFace}
            fill={`url(#${ids.woodFace})`}
          />
          <rect
            x={x}
            y={postTop}
            width={postWidth}
            height={postTopFace}
            fill={`url(#${ids.woodTop})`}
          />
          <rect
            x={x}
            y={postTop}
            width={postWidth}
            height={contactY - postTop}
            fill={`url(#${ids.postGrain})`}
            style={{ mixBlendMode: "overlay" }}
            opacity="0.6"
          />
          <rect
            x={x}
            y={postTop}
            width={postWidth}
            height={contactY - postTop}
            fill={`url(#${ids.woodSide})`}
          />
          <rect
            x={x}
            y={postTop}
            width={postWidth}
            height={contactY - postTop}
            fill={`url(#${ids.falloff})`}
          />
          <rect
            x={x}
            y={postTop + postTopFace - 0.4}
            width={postWidth}
            height={1}
            fill="var(--wood-bevel)"
          />
        </g>
      ))}

      {rowGeometry.map((geometry) => {
        const centers = geometry.tubes.map(
          (tube) => tube.left + tube.width / 2,
        );
        return (
          <g key={geometry.row.top}>
            {woodBoard(
              `holder-${geometry.row.top}`,
              geometry.holderBack,
              geometry.holderFront,
              geometry.holderBottom,
              centers,
            )}
            {woodBoard(
              `base-${geometry.row.top}`,
              geometry.baseBack,
              geometry.baseFront,
              geometry.baseBottom,
              [],
            )}
            {geometry.tubes.map((tube) => {
              const colorIndex = state[tube.bottleIndex]?.[0];
              const center = tube.left + tube.width / 2;
              const caustic =
                colorIndex === undefined
                  ? null
                  : getRealReagentCaustic(colorIndex);
              const castY = geometry.tubeBottom + baseTopHeight * 0.25;
              return (
                <g key={`cast-${tube.bottleIndex}`}>
                  {/* 底の触れる所の、光の届かない隅 */}
                  <ellipse
                    cx={center}
                    cy={geometry.tubeBottom}
                    rx={w * 0.3}
                    ry={Math.max(1, baseTopHeight * 0.18)}
                    fill="var(--wood-cast)"
                  />
                  {/* ガラスの影。光を集めて抜く芯の周りに、縁の影が落ちる。 */}
                  <ellipse
                    cx={center + w * CAST_SHIFT * 0.6}
                    cy={castY}
                    rx={w * 0.46}
                    ry={baseTopHeight * 0.32}
                    fill="var(--wood-cast)"
                    filter={`url(#${ids.softBlur})`}
                  />
                  {caustic &&
                    colorIndex !== undefined &&
                    getRealReagentLook(colorIndex) !== "milky" && (
                      <ellipse
                        cx={center + w * CAST_SHIFT}
                        cy={castY}
                        rx={w * 0.26}
                        ry={baseTopHeight * 0.22}
                        fill={caustic.color}
                        opacity={caustic.strength}
                        filter={`url(#${ids.softBlur})`}
                      />
                    )}
                  {caustic &&
                    colorIndex !== undefined &&
                    getRealReagentLook(colorIndex) === "milky" && (
                      <ellipse
                        cx={center + w * CAST_SHIFT * 0.6}
                        cy={castY}
                        rx={w * 0.4}
                        ry={baseTopHeight * 0.3}
                        fill={caustic.color}
                        opacity={caustic.strength}
                        filter={`url(#${ids.softBlur})`}
                      />
                    )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
