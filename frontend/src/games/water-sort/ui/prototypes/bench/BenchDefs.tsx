// 試作 bench の盤面で共有する塗り。ほかの svg から url(#bn-…) で参照する。
import { memo } from "react";
import { CAVITY_D } from "@/games/water-sort/ui/prototypes/bench/geometry";
import {
  LIQUID_COLOR_COUNT,
  liquidPaint,
} from "@/games/water-sort/ui/prototypes/bench/paint";

export const BenchDefs = memo(function BenchDefs() {
  const colors = Array.from({ length: LIQUID_COLOR_COUNT }, (_, i) => i);
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <defs>
        <clipPath id="bn-cavity" clipPathUnits="userSpaceOnUse">
          <path d={CAVITY_D} />
        </clipPath>
        <linearGradient
          id="bn-cyl"
          x1="-22"
          x2="22"
          y1="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#000" stopOpacity=".16" />
          <stop offset=".1" stopColor="#fff" stopOpacity=".34" />
          <stop offset=".24" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".46" stopColor="#fff" stopOpacity="0" />
          <stop offset=".74" stopColor="#000" stopOpacity=".1" />
          <stop offset="1" stopColor="#000" stopOpacity=".3" />
        </linearGradient>
        <linearGradient
          id="bn-glass"
          x1="-26"
          x2="26"
          y1="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity=".42" />
          <stop offset=".2" stopColor="#ffffff" stopOpacity=".08" />
          <stop offset=".7" stopColor="#e2ecf4" stopOpacity=".05" />
          <stop offset="1" stopColor="#b6c8d8" stopOpacity=".36" />
        </linearGradient>
        <linearGradient id="bn-hl" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".07" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".68" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="bn-cork" cx=".32" cy=".28" r=".95">
          <stop offset="0" stopColor="#e6bd8a" />
          <stop offset=".55" stopColor="#c8955e" />
          <stop offset="1" stopColor="#9a6a3c" />
        </radialGradient>
        <radialGradient id="bn-cork-top" cx=".4" cy=".35" r=".8">
          <stop offset="0" stopColor="#ecc896" />
          <stop offset="1" stopColor="#c9975f" />
        </radialGradient>
        <pattern
          id="bn-cork-pores"
          width="7"
          height="6"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.5" cy="1.4" r=".7" fill="#7c5129" opacity=".45" />
          <circle cx="5" cy="3.6" r=".55" fill="#7c5129" opacity=".4" />
          <circle cx="3.2" cy="5.2" r=".4" fill="#fff1d6" opacity=".35" />
        </pattern>
        <radialGradient id="bn-sparkle" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".3" stopColor="#fff" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bn-shadow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#3b2410" stopOpacity=".55" />
          <stop offset="1" stopColor="#3b2410" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bn-sweep" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0" />
          <stop offset=".35" stopColor="#fff6dc" stopOpacity=".45" />
          <stop offset=".5" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset=".65" stopColor="#fff6dc" stopOpacity=".45" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="bn-wood-top" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e3c28c" />
          <stop offset="1" stopColor="#f0d7a8" />
        </linearGradient>
        <linearGradient id="bn-wood-front" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#d5a466" />
          <stop offset=".55" stopColor="#c48f55" />
          <stop offset="1" stopColor="#a87640" />
        </linearGradient>
        <linearGradient id="bn-wood-hfront" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff3d8" stopOpacity=".28" />
          <stop offset=".3" stopColor="#fff3d8" stopOpacity="0" />
          <stop offset=".8" stopColor="#3a2208" stopOpacity="0" />
          <stop offset="1" stopColor="#3a2208" stopOpacity=".18" />
        </linearGradient>
        <linearGradient id="bn-post-l" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#e8c38b" />
          <stop offset=".65" stopColor="#d2a265" />
          <stop offset="1" stopColor="#ae7c42" />
        </linearGradient>
        <linearGradient id="bn-post-r" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#c99658" />
          <stop offset=".5" stopColor="#b9864b" />
          <stop offset="1" stopColor="#966537" />
        </linearGradient>
        <linearGradient id="bn-dowel" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#eccf9c" />
          <stop offset=".5" stopColor="#cfa16a" />
          <stop offset="1" stopColor="#a67643" />
        </linearGradient>
        <filter id="bn-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.5"
            numOctaves="3"
            seed="7"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.10  0 0 0 2.4 -0.95"
            result="c"
          />
          <feComposite in="c" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id="bn-grain-v" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.5 0.012"
            numOctaves="3"
            seed="11"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.10  0 0 0 2.4 -0.95"
            result="c"
          />
          <feComposite in="c" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id="bn-blur2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="bn-blur5" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        {colors.map((i) => {
          const p = liquidPaint(i);
          return (
            <linearGradient
              key={`l${i}`}
              id={`bn-liq-${i}`}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0" stopColor={p.light} />
              <stop offset="1" stopColor={p.deep} />
            </linearGradient>
          );
        })}
        {colors.map((i) => {
          const p = liquidPaint(i);
          return (
            <radialGradient key={`g${i}`} id={`bn-glow-${i}`}>
              <stop offset="0" stopColor={p.base} stopOpacity=".7" />
              <stop offset="1" stopColor={p.base} stopOpacity="0" />
            </radialGradient>
          );
        })}
      </defs>
    </svg>
  );
});

export function liquidFill(colorIndex: number) {
  return colorIndex < LIQUID_COLOR_COUNT
    ? `url(#bn-liq-${colorIndex})`
    : liquidPaint(colorIndex).base;
}

export function glowFill(colorIndex: number) {
  return colorIndex < LIQUID_COLOR_COUNT
    ? `url(#bn-glow-${colorIndex})`
    : liquidPaint(colorIndex).base;
}
