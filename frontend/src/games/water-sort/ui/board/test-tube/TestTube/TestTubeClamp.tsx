import { useId } from "react";

import { TUBE_VIEW_BOX } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

type TestTubeClampProps = {
  /** 柄を出す向き。 */
  side: "left" | "right";
};

/** 持っている試験管の首を挟む、木の試験管ばさみ。並んだ試験管の中でも持っている1本が分かるよう、口と柄を太く描く。 */
export function TestTubeClamp({ side }: TestTubeClampProps) {
  const woodId = useId();
  const armId = useId();
  return (
    <svg
      data-test-tube-clamp=""
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible animate-in fade-in zoom-in-110 duration-150 ease-out motion-reduce:animate-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={woodId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dcaa" />
          <stop offset="0.4" stopColor="#d9a964" />
          <stop offset="1" stopColor="#9c6a34" />
        </linearGradient>
        <linearGradient id={armId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a8743c" />
          <stop offset="0.45" stopColor="#ecc68c" />
          <stop offset="1" stopColor="#94622f" />
        </linearGradient>
      </defs>
      <g
        transform={side === "left" ? "translate(36 0) scale(-1 1)" : undefined}
      >
        {/* 首に落ちる影 */}
        <rect
          x="-1"
          y="18.4"
          width="38"
          height="2.6"
          rx="1.2"
          fill="rgba(40,22,6,0.32)"
        />
        {/* 柄（2本の腕） */}
        <path
          d="M30.6 10.4 L36.2 17.4 L57.4 -5.2 L53 -8.6 Z"
          fill={`url(#${armId})`}
          stroke="rgba(80,45,15,0.55)"
          strokeWidth="0.5"
        />
        <path
          d="M33.4 14 L55.2 -6.9"
          stroke="rgba(70,40,15,0.5)"
          strokeWidth="0.6"
        />
        {/* ばね */}
        <g fill="none" stroke="#7e898f" strokeWidth="0.9">
          <ellipse cx="39.8" cy="7.2" rx="2.4" ry="1.6" />
          <ellipse cx="41" cy="4.8" rx="2.4" ry="1.6" />
        </g>
        {/* 首を挟む口 */}
        <rect
          x="-2.6"
          y="10.2"
          width="40.6"
          height="8.4"
          rx="2.2"
          fill={`url(#${woodId})`}
          stroke="rgba(80,45,15,0.75)"
          strokeWidth="0.6"
        />
        <path
          d="M-1.2 11.6 H36.6"
          stroke="rgba(255,244,222,0.85)"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        <path
          d="M-2 14.4 H37.4"
          stroke="rgba(80,45,15,0.45)"
          strokeWidth="0.5"
        />
      </g>
    </svg>
  );
}
