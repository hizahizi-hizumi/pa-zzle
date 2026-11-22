import { useId } from "react";

import {
  TUBE_INNER,
  TUBE_VIEW_BOX,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const slotHeight = (TUBE_INNER.bottom - TUBE_INNER.slotTop) / 4;
const majorTicks = [0, 1, 2, 3].map(
  (index) => TUBE_INNER.slotTop + slotHeight * index,
);
const minorTicks = majorTicks.map((y) => y + slotHeight / 2);

// 水平な円は、見下ろした角度の分だけ縦につぶれた楕円に見える（縦 = 横 × 0.12）。
const RIM_CENTER_Y = 4.9;
const RIM_OUTER_RX = 16.2;
const RIM_OUTER_RY = RIM_OUTER_RX * 0.12;
const RIM_INNER_RX = 13.4;
const RIM_INNER_RY = RIM_INNER_RX * 0.12;
const BEAD_HEIGHT = 1.9;

const wallPath =
  "M3.6 6 V88 A14.4 9.2 0 0 0 32.4 88 V6 H31.1 V88.2 A13.1 7.4 0 0 1 4.9 88.2 V6 Z";
const beadPath = `M${18 - RIM_OUTER_RX} ${RIM_CENTER_Y} A${RIM_OUTER_RX} ${RIM_OUTER_RY} 0 0 0 ${18 + RIM_OUTER_RX} ${RIM_CENTER_Y} V${RIM_CENTER_Y + BEAD_HEIGHT} A${RIM_OUTER_RX} ${RIM_OUTER_RY} 0 0 1 ${18 - RIM_OUTER_RX} ${RIM_CENTER_Y + BEAD_HEIGHT} Z`;
const rimRingPath = `${ellipsePath(RIM_OUTER_RX, RIM_OUTER_RY, RIM_CENTER_Y)} ${ellipsePath(RIM_INNER_RX, RIM_INNER_RY, RIM_CENTER_Y + 0.15)}`;
const SLOT_HEIGHT = (TUBE_INNER.bottom - TUBE_INNER.slotTop) / 4;

function ellipsePath(rx: number, ry: number, cy: number): string {
  return `M${18 - rx} ${cy} A${rx} ${ry} 0 1 0 ${18 + rx} ${cy} A${rx} ${ry} 0 1 0 ${18 - rx} ${cy} Z`;
}

// 窓の像のつやは、窓の横の桟の所で切れる。
const windowReflectionSegments = [
  [9, 29.5],
  [32.5, 84],
] as const;

export type GlowingSlots = {
  startSlot: number;
  slotCount: number;
};

type RealGlassFrontProps = {
  /** 栓をしている間は、口の奥の縁と口の中が栓に隠れる。 */
  stoppered: boolean;
  /** 蛍光の液が入っている段。液が出す光がガラスの壁の中を伝い、その高さの壁が光る。 */
  glowingSlots: readonly GlowingSlots[];
};

/**
 * 液の手前のガラス。壁は斜めに見る所ほど光を曲げて暗く、光の来る左の縁にだけ窓のつやが立つ。
 * 右の縁と底には、透った光がかすかに抜ける。口は、見下ろした分だけ楕円に見える、厚く巻いた縁。
 */
export function RealGlassFront({
  stoppered,
  glowingSlots,
}: RealGlassFrontProps) {
  const ids = {
    wallClip: useId(),
    wall: useId(),
    reflection: useId(),
    bead: useId(),
    rimTop: useId(),
  };
  return (
    <svg
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={ids.wallClip}>
          <path d={wallPath} />
        </clipPath>
        <linearGradient id={ids.wall} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(22,36,38)" stopOpacity="0.5" />
          <stop offset="0.045" stopColor="rgb(22,36,38)" stopOpacity="0.3" />
          <stop offset="0.5" stopColor="rgb(22,36,38)" stopOpacity="0.32" />
          <stop offset="0.955" stopColor="rgb(22,36,38)" stopOpacity="0.42" />
          <stop offset="1" stopColor="rgb(12,22,24)" stopOpacity="0.68" />
        </linearGradient>
        <linearGradient id={ids.reflection} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.08" stopColor="white" stopOpacity="0.95" />
          <stop offset="0.85" stopColor="white" stopOpacity="0.7" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.bead} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(250,253,252)" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="rgb(214,230,228)" stopOpacity="0.4" />
          <stop offset="0.72" stopColor="rgb(22,36,38)" stopOpacity="0.5" />
          <stop offset="1" stopColor="rgb(22,36,38)" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={ids.rimTop} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="rgb(232,242,240)" stopOpacity="0.6" />
          <stop offset="1" stopColor="rgb(200,215,214)" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {/* 壁の厚み */}
      <path d={wallPath} fill={`url(#${ids.wall})`} />
      {glowingSlots.length > 0 && (
        <g clipPath={`url(#${ids.wallClip})`}>
          {glowingSlots.map(({ startSlot, slotCount }) => (
            <rect
              key={startSlot}
              x="0"
              y={TUBE_INNER.bottom - SLOT_HEIGHT * (startSlot + slotCount)}
              width="36"
              height={SLOT_HEIGHT * slotCount + (startSlot === 0 ? 3 : 0)}
              fill="#efffa0"
              opacity="0.9"
            />
          ))}
        </g>
      )}
      {/* 底の厚いガラスを抜けた光 */}
      <path
        d="M22 96.6 Q28.6 95.4 31.4 90.6"
        fill="none"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      {/* 右の壁の内側に抜ける光 */}
      <path
        d="M30.5 12 V84"
        stroke="rgba(255,255,255,0.26)"
        strokeWidth="0.45"
        strokeLinecap="round"
      />
      {/* 目盛り（白い焼き付け） */}
      <g strokeWidth="0.45" strokeLinecap="round" stroke="white">
        {majorTicks.map((y) => (
          <path key={y} d={`M21.4 ${y} H26.4`} strokeOpacity="0.62" />
        ))}
        {minorTicks.map((y) => (
          <path key={y} d={`M23.8 ${y} H26.4`} strokeOpacity="0.5" />
        ))}
      </g>
      {/* 窓のつや（左の縁） */}
      {windowReflectionSegments.map(([top, bottom]) => (
        <g key={top}>
          <rect
            x="4.6"
            y={top}
            width="3.6"
            height={bottom - top}
            rx="1.8"
            fill={`url(#${ids.reflection})`}
            opacity="0.16"
          />
          <rect
            x="5.1"
            y={top}
            width="1"
            height={bottom - top}
            rx="0.5"
            fill={`url(#${ids.reflection})`}
            opacity="0.9"
          />
        </g>
      ))}
      <path
        d="M3.9 8.5 V86"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.4"
        strokeLinecap="round"
      />
      <path
        d="M4.2 88.5 A13.9 8.6 0 0 0 9.5 95.2"
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="0.45"
        strokeLinecap="round"
      />
      {/* 口の縁 */}
      {!stoppered && (
        <>
          <path
            d={rimRingPath}
            fill={`url(#${ids.rimTop})`}
            fillRule="evenodd"
          />
          <ellipse
            cx="18"
            cy={RIM_CENTER_Y + 0.15}
            rx={RIM_INNER_RX}
            ry={RIM_INNER_RY}
            fill="rgba(40,62,64,0.1)"
          />
        </>
      )}
      <path d={beadPath} fill={`url(#${ids.bead})`} />
      <ellipse
        cx="3.3"
        cy={RIM_CENTER_Y + 0.6}
        rx="1.1"
        ry="0.65"
        fill="white"
        opacity="0.95"
      />
    </svg>
  );
}
