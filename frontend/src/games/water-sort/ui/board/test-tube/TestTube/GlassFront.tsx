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

type GlassFrontProps = {
  /** 持っている間、縁を明るくする。 */
  held: boolean;
};

/** 液の手前に見える、厚みのあるガラスの壁・口の縁・窓の光の映り込み・目盛り。 */
export function GlassFront({ held }: GlassFrontProps) {
  const highlightId = useId();
  return (
    <svg
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={highlightId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.12" stopColor="white" stopOpacity="0.85" />
          <stop offset="0.7" stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* ガラスの厚み */}
      <path
        d="M4.25 7 V88.1 A13.75 8.3 0 0 0 31.75 88.1 V7"
        fill="none"
        className="stroke-[rgba(205,232,228,0.5)] dark:stroke-[rgba(180,215,225,0.28)]"
        strokeWidth="1.3"
      />
      <path
        d="M3.6 7 V88 A14.4 9.2 0 0 0 32.4 88 V7"
        fill="none"
        className={
          held
            ? "stroke-[rgba(20,44,46,0.8)] dark:stroke-[rgba(225,245,250,0.85)]"
            : "stroke-[rgba(28,56,58,0.55)] dark:stroke-[rgba(200,228,238,0.5)]"
        }
        strokeWidth="0.8"
      />
      <path
        d="M4.9 7.5 V88.2 A13.1 7.4 0 0 0 31.1 88.2 V7.5"
        fill="none"
        className="stroke-[rgba(255,255,255,0.5)] dark:stroke-[rgba(220,240,255,0.25)]"
        strokeWidth="0.5"
      />
      {/* 目盛り（白い焼き付け） */}
      <g strokeWidth="0.55" strokeLinecap="round">
        {majorTicks.map((y) => (
          <g key={y}>
            <path
              d={`M21.6 ${y + 0.45} H27.4`}
              className="stroke-[rgba(10,30,30,0.18)]"
            />
            <path
              d={`M21.6 ${y} H27.4`}
              className="stroke-[rgba(255,255,255,0.82)]"
            />
          </g>
        ))}
        {minorTicks.map((y) => (
          <g key={y}>
            <path
              d={`M24.4 ${y + 0.45} H27.4`}
              className="stroke-[rgba(10,30,30,0.15)]"
            />
            <path
              d={`M24.4 ${y} H27.4`}
              className="stroke-[rgba(255,255,255,0.7)]"
            />
          </g>
        ))}
      </g>
      {/* 窓の光の映り込み */}
      <rect
        x="6.5"
        y="9"
        width="1.8"
        height="78"
        rx="0.9"
        fill={`url(#${highlightId})`}
        className="opacity-80 dark:opacity-60"
      />
      <rect
        x="9.4"
        y="14"
        width="0.6"
        height="60"
        rx="0.3"
        fill={`url(#${highlightId})`}
        opacity="0.35"
      />
      <rect
        x="28.7"
        y="12"
        width="0.9"
        height="70"
        rx="0.45"
        fill={`url(#${highlightId})`}
        opacity="0.4"
      />
      <ellipse
        cx="13"
        cy="92.4"
        rx="3.4"
        ry="1.1"
        fill="white"
        className="opacity-50 dark:opacity-30"
      />
      {/* 口の縁（外へ少し開いた厚いガラス） */}
      <rect
        x="1.7"
        y="3.4"
        width="32.6"
        height="4.2"
        rx="2.1"
        className={
          held
            ? "fill-[rgba(225,242,240,0.7)] stroke-[rgba(20,44,46,0.8)] dark:fill-[rgba(200,225,235,0.45)] dark:stroke-[rgba(225,245,250,0.85)]"
            : "fill-[rgba(215,236,233,0.5)] stroke-[rgba(28,56,58,0.55)] dark:fill-[rgba(180,210,222,0.25)] dark:stroke-[rgba(200,228,238,0.5)]"
        }
        strokeWidth="0.7"
      />
      <path
        d="M4 4.5 H22"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
        className="opacity-90 dark:opacity-60"
      />
    </svg>
  );
}
