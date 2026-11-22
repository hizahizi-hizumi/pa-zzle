import { useEffect, useId, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion";

/** 炎のゆらぎ。目の端でかすかに揺れる程度にとどめる。 */
const FLAME_FLICKER: Keyframe[] = [
  { transform: "scale(1, 1) skewX(0deg)" },
  { transform: "scale(0.96, 1.06) skewX(-2deg)", offset: 0.22 },
  { transform: "scale(1.02, 0.95) skewX(1.5deg)", offset: 0.45 },
  { transform: "scale(0.98, 1.04) skewX(-1deg)", offset: 0.7 },
  { transform: "scale(1, 1) skewX(0deg)" },
];
const FLAME_FLICKER_MS = 3700;

/** 机の右手に立つ蝋燭。工房の光の源。 */
export function WorkshopCandle() {
  const id = useId();
  const flameRef = useRef<SVGGElement>(null);
  const waxId = `${id}-wax`;
  const flameId = `${id}-flame`;
  const brassId = `${id}-brass`;
  const haloId = `${id}-halo`;

  useEffect(() => {
    const flame = flameRef.current;
    if (!flame?.animate || prefersReducedMotion()) {
      return;
    }
    const animation = flame.animate(FLAME_FLICKER, {
      duration: FLAME_FLICKER_MS,
      iterations: Number.POSITIVE_INFINITY,
      easing: "ease-in-out",
    });
    return () => animation.cancel();
  }, []);

  return (
    <svg
      className="absolute right-1 bottom-7 h-[132px] w-[64px] overflow-visible"
      viewBox="0 0 64 132"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={waxId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7d6a50" />
          <stop offset="0.35" stopColor="#d9c7a3" />
          <stop offset="0.6" stopColor="#f2e3c2" />
          <stop offset="1" stopColor="#9b8462" />
        </linearGradient>
        <radialGradient id={flameId} cx="0.5" cy="0.72" r="0.6">
          <stop offset="0" stopColor="#fffbe8" />
          <stop offset="0.35" stopColor="#ffe08a" />
          <stop offset="0.75" stopColor="#ff9a32" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={haloId}>
          <stop offset="0" stopColor="#ffd58a" stopOpacity="0.45" />
          <stop offset="0.4" stopColor="#ffb054" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ff9a40" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={brassId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#3d2a12" />
          <stop offset="0.4" stopColor="#a07a3c" />
          <stop offset="0.55" stopColor="#e2bf78" />
          <stop offset="1" stopColor="#4a3216" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="30" r="34" fill={`url(#${haloId})`} />
      {/* 燭台 */}
      <ellipse cx="32" cy="124" rx="26" ry="6" fill="#000" opacity="0.5" />
      <path
        d="M 8 118 Q 8 125 32 125 Q 56 125 56 118 Q 56 114 32 114 Q 8 114 8 118 Z"
        fill={`url(#${brassId})`}
      />
      <ellipse
        cx="32"
        cy="116.5"
        rx="21"
        ry="3.2"
        fill="#2a1c0c"
        opacity="0.6"
      />
      {/* 蝋燭の胴と垂れ */}
      <path
        d="M 22 116 L 22 54 Q 22 50 26 49.5 L 38 49.5 Q 42 50 42 54 L 42 116 Z"
        fill={`url(#${waxId})`}
      />
      <path
        d="M 23 52 Q 22 62 24 66 Q 25.5 69 26.5 64 L 27 52 Z M 36 51 Q 37 58 38.5 59 Q 40 60 40 55 L 40 51 Z"
        fill="#efe0bf"
        opacity="0.85"
      />
      <ellipse cx="32" cy="50.5" rx="10" ry="2.2" fill="#c9b48e" />
      <path
        d="M 32 50 Q 31.5 46 32.3 43"
        stroke="#1a120a"
        strokeWidth="1.1"
        fill="none"
      />
      {/* 炎 */}
      <g
        ref={flameRef}
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
      >
        <path
          d="M 32 18 C 35.5 26 38 31 38 36.5 C 38 41 35.4 44.5 32 44.5 C 28.6 44.5 26 41 26 36.5 C 26 31 28.5 26 32 18 Z"
          fill={`url(#${flameId})`}
        />
        <ellipse cx="32" cy="41" rx="2.4" ry="3" fill="#6a8cff" opacity="0.5" />
      </g>
    </svg>
  );
}
