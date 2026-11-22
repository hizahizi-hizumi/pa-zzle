import { useId } from "react";

import { TUBE_VIEW_BOX } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

/** 液の後ろに見える奥のガラス。手前と奥の2枚の壁を透るので、縁へ寄るほど暗く、奥の壁の内側の縁がかすかに見える。 */
export function RealGlassBack() {
  const interiorId = useId();
  return (
    <svg
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={interiorId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(30,48,50)" stopOpacity="0.2" />
          <stop offset="0.12" stopColor="rgb(255,255,255)" stopOpacity="0.04" />
          <stop offset="0.5" stopColor="rgb(255,255,255)" stopOpacity="0.07" />
          <stop offset="0.66" stopColor="rgb(255,255,255)" stopOpacity="0.12" />
          <stop offset="0.86" stopColor="rgb(30,48,50)" stopOpacity="0.04" />
          <stop offset="1" stopColor="rgb(30,48,50)" stopOpacity="0.24" />
        </linearGradient>
      </defs>
      <path
        d="M4.9 6 V88.2 A13.1 7.4 0 0 0 31.1 88.2 V6 Z"
        fill={`url(#${interiorId})`}
      />
      <g fill="none" strokeWidth="0.45" strokeLinecap="round">
        <path d="M6.3 9 V86" stroke="rgba(28,44,46,0.16)" />
        <path d="M29.7 9 V86" stroke="rgba(28,44,46,0.2)" />
      </g>
    </svg>
  );
}
