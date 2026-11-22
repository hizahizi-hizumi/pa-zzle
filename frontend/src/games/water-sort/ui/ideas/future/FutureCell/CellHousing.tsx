import { useId } from "react";

import {
  CELL_FLUID,
  CELL_TUBE,
  CELL_VIEW_HEIGHT,
  CELL_VIEW_WIDTH,
} from "@/games/water-sort/ui/ideas/future/future-cell-geometry";

type CellHousingProps = {
  selected: boolean;
  /** ロックしているときの、液の発光色。 */
  lockGlow: string | undefined;
};

const RING_IDLE = "#26323b";
const RING_ENGAGED = "#d4f3ff";

/** 管のガラスの照りと目盛り、削り出しの口金と台座、端子。液の手前に重ねる。 */
export function CellHousing({ selected, lockGlow }: CellHousingProps) {
  const id = useId();
  const metalId = `${id}-metal`;
  const glassId = `${id}-glass`;
  const glowId = `${id}-glow`;
  const ringColor = lockGlow ?? (selected ? RING_ENGAGED : RING_IDLE);
  const ringLit = lockGlow !== undefined || selected;
  const fluidHeight = CELL_FLUID.bottom - CELL_FLUID.top;
  const tickYs = [1, 2, 3].map(
    (slot) => CELL_FLUID.bottom - (fluidHeight * slot) / 4,
  );

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full overflow-visible"
      viewBox={`0 0 ${CELL_VIEW_WIDTH} ${CELL_VIEW_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={metalId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#151b21" />
          <stop offset="0.18" stopColor="#3c4651" />
          <stop offset="0.34" stopColor="#a3aeb9" />
          <stop offset="0.44" stopColor="#6d7883" />
          <stop offset="0.7" stopColor="#2c343d" />
          <stop offset="0.88" stopColor="#444e58" />
          <stop offset="1" stopColor="#12171c" />
        </linearGradient>
        <linearGradient id={glassId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.12" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>

      <rect
        x={CELL_TUBE.left}
        y={CELL_TUBE.top}
        width={CELL_TUBE.right - CELL_TUBE.left}
        height={CELL_TUBE.bottom - CELL_TUBE.top}
        rx="2.4"
        fill="none"
        stroke={selected ? "rgba(205,240,255,0.62)" : "rgba(168,204,220,0.34)"}
        strokeWidth="0.7"
        vectorEffect="non-scaling-stroke"
        style={{ transition: "stroke 200ms" }}
      />
      <rect
        x={CELL_FLUID.left + 0.5}
        y={CELL_FLUID.top - 1}
        width="1.3"
        height={fluidHeight}
        rx="0.6"
        fill={`url(#${glassId})`}
      />
      <rect
        x={CELL_FLUID.right - 1.2}
        y={CELL_FLUID.top + 4}
        width="0.5"
        height={fluidHeight * 0.7}
        fill={`url(#${glassId})`}
        opacity="0.5"
      />
      {tickYs.map((y) => (
        <line
          key={y}
          x1={CELL_TUBE.right - 2.2}
          x2={CELL_TUBE.right}
          y1={y}
          y2={y}
          stroke="rgba(196,228,240,0.38)"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* 口金 */}
      <path
        d="M4.6 0.6 H31.4 L32.8 2 V9.2 H3.2 V2 Z"
        fill={`url(#${metalId})`}
      />
      <rect
        x="3.2"
        y="0.6"
        width="29.6"
        height="0.5"
        fill="#ffffff"
        opacity="0.22"
      />
      <rect
        x="3.2"
        y="3.3"
        width="29.6"
        height="0.35"
        fill="#05080b"
        opacity="0.55"
      />
      <rect
        x="3.2"
        y="8.6"
        width="29.6"
        height="0.6"
        fill="#05080b"
        opacity="0.5"
      />
      {ringLit && (
        <rect
          x="3.2"
          y="4.9"
          width="29.6"
          height="1.6"
          fill={ringColor}
          filter={`url(#${glowId})`}
          opacity="0.9"
        />
      )}
      <rect
        x="3.2"
        y="5.1"
        width="29.6"
        height="1.2"
        fill={ringColor}
        style={{ transition: "fill 200ms" }}
      />
      {/* 口。ロックすると閉じる。 */}
      <rect
        x="10.5"
        y="0"
        width="15"
        height="1.5"
        rx="0.4"
        fill={lockGlow ? "#8d98a3" : "#04070a"}
      />

      {/* 台座と端子 */}
      <path
        d="M3.4 88.2 H32.6 V95.6 L31 97.2 H5 L3.4 95.6 Z"
        fill={`url(#${metalId})`}
      />
      <rect
        x="3.4"
        y="88.2"
        width="29.2"
        height="0.5"
        fill="#ffffff"
        opacity="0.18"
      />
      <rect
        x="3.4"
        y="90.6"
        width="29.2"
        height="0.35"
        fill="#05080b"
        opacity="0.6"
      />
      <rect x="9.6" y="97.2" width="3" height="2.8" fill="#59636d" />
      <rect x="23.4" y="97.2" width="3" height="2.8" fill="#59636d" />
      {lockGlow && (
        <rect
          x="11"
          y="92.4"
          width="14"
          height="2"
          rx="0.6"
          fill={lockGlow}
          filter={`url(#${glowId})`}
        />
      )}
      <rect
        x="11.5"
        y="92.8"
        width="13"
        height="1.2"
        rx="0.5"
        fill={lockGlow ?? "#141c23"}
      />
    </svg>
  );
}
