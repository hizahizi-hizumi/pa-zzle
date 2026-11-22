import { useId } from "react";

export type LabClampSide = "left" | "right";

type LabClampProps = {
  /** 柄を出す向き。 */
  side: LabClampSide;
};

import { TUBE_VIEW_BOX } from "@/games/water-sort/ui/ideas/lab/lab-tube-geometry";

/** 持っている試験管の首を挟む、木の試験管ばさみ。 */
export function LabClamp({ side }: LabClampProps) {
  const woodId = useId();
  const armId = useId();
  return (
    <svg
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible animate-in fade-in zoom-in-110 duration-150 ease-out motion-reduce:animate-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={woodId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1d3a1" />
          <stop offset="0.45" stopColor="#d6a86a" />
          <stop offset="1" stopColor="#a9763f" />
        </linearGradient>
        <linearGradient id={armId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b98448" />
          <stop offset="0.5" stopColor="#e6c189" />
          <stop offset="1" stopColor="#a06c37" />
        </linearGradient>
      </defs>
      <g
        transform={side === "left" ? "translate(36 0) scale(-1 1)" : undefined}
      >
        {/* 柄（2本の腕） */}
        <path
          d="M31.5 11.5 L35.2 16 L47.8 -11 L44.6 -12.4 Z"
          fill={`url(#${armId})`}
        />
        <path
          d="M33.2 13.6 L46.2 -11.7"
          stroke="rgba(70,40,15,0.45)"
          strokeWidth="0.45"
        />
        {/* ばね */}
        <circle
          cx="38.4"
          cy="6.8"
          r="1.7"
          fill="none"
          stroke="#8f9aa0"
          strokeWidth="0.75"
        />
        {/* 首を挟む口 */}
        <rect
          x="-1.6"
          y="11.2"
          width="38.4"
          height="5.6"
          rx="1.6"
          fill={`url(#${woodId})`}
          stroke="rgba(90,55,20,0.55)"
          strokeWidth="0.45"
        />
        <path
          d="M-0.4 12.2 H35.6"
          stroke="rgba(255,240,215,0.7)"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
        <path d="M-1 14 H36" stroke="rgba(90,55,20,0.35)" strokeWidth="0.35" />
      </g>
    </svg>
  );
}
