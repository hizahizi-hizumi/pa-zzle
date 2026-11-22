import { useId } from "react";

import {
  NOISE_TILE_SIZE,
  WOOD_GRAIN_URI,
} from "@/games/water-sort/ui/art/real/real-texture";
import {
  CLAMP_HANDLE_TIP_POINTS,
  TUBE_VIEW_BOX,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

const [[tipBottomX, tipBottomY], [tipTopX, tipTopY]] = CLAMP_HANDLE_TIP_POINTS;
const ARM_PATH = `M31 10.6 L37.6 17.8 L${tipBottomX} ${tipBottomY} L${tipTopX} ${tipTopY} Z`;
const JAW = { left: -2.6, right: 38, top: 10.2, bottom: 18.6 } as const;
// 木の口の上の面。奥行きのある板を見下ろした分だけ見える。
const JAW_TOP_FACE = 1.3;
// 14本の盤面の試験管（幅 44px）では、試験管の座標の 1 が約 1.2px になる。そこで他の木と同じ細かさになる大きさで敷く。
const GRAIN_TILE = NOISE_TILE_SIZE / 1.2;

type RealClampProps = {
  /** 柄を出す向き。 */
  side: "left" | "right";
};

/**
 * 持っている試験管の首を挟む、木の試験管ばさみ。柄の向きを左右に入れ替えても、光はいつも左上の奥から当てるので、
 * 横向きの陰影だけは入れ替えない。
 */
export function RealClamp({ side }: RealClampProps) {
  const ids = {
    front: useId(),
    top: useId(),
    leftLight: useId(),
    arm: useId(),
    grain: useId(),
  };
  const mirrored = side === "left";
  // 鏡に映した図の中でも、光の来る左を明るくする。
  const lightFrom = mirrored ? { x1: "1", x2: "0" } : { x1: "0", x2: "1" };
  return (
    <svg
      data-test-tube-clamp=""
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible animate-in fade-in zoom-in-110 duration-150 ease-out motion-reduce:animate-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={ids.front} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4b97c" />
          <stop offset="0.45" stopColor="#c8955a" />
          <stop offset="1" stopColor="#94622f" />
        </linearGradient>
        <linearGradient id={ids.top} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dfb0" />
          <stop offset="1" stopColor="#ecca92" />
        </linearGradient>
        <linearGradient id={ids.leftLight} {...lightFrom} y1="0" y2="0">
          <stop offset="0" stopColor="#fff3d8" stopOpacity="0.4" />
          <stop offset="0.3" stopColor="#fff3d8" stopOpacity="0" />
          <stop offset="0.8" stopColor="#2a1606" stopOpacity="0" />
          <stop offset="1" stopColor="#2a1606" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={ids.arm} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0cf98" />
          <stop offset="0.5" stopColor="#cf9c5e" />
          <stop offset="1" stopColor="#8d5c2c" />
        </linearGradient>
        <pattern
          id={ids.grain}
          patternUnits="userSpaceOnUse"
          width={GRAIN_TILE}
          height={GRAIN_TILE}
        >
          <image href={WOOD_GRAIN_URI} width={GRAIN_TILE} height={GRAIN_TILE} />
        </pattern>
      </defs>
      <g transform={mirrored ? "translate(36 0) scale(-1 1)" : undefined}>
        {/* 柄（2枚の板を重ねた腕） */}
        <path d={ARM_PATH} fill={`url(#${ids.arm})`} />
        <path d={ARM_PATH} fill={`url(#${ids.leftLight})`} />
        <path
          d="M34.2 14.2 L56.6 3.7"
          stroke="rgba(60,32,10,0.5)"
          strokeWidth="0.5"
        />
        <path
          d="M34.6 14.9 L56.9 4.4"
          stroke="rgba(255,236,200,0.45)"
          strokeWidth="0.35"
        />
        <path
          d={`M31.3 10.5 L${tipTopX} ${tipTopY + 0.1}`}
          stroke="rgba(255,240,212,0.75)"
          strokeWidth="0.4"
        />
        {/* ばね（鋼の線）。上の面が光を受ける。 */}
        <g fill="none" strokeWidth="0.9">
          <ellipse cx="40.4" cy="10.2" rx="2.3" ry="1.5" stroke="#5c666b" />
          <ellipse cx="41.8" cy="8" rx="2.3" ry="1.5" stroke="#5c666b" />
        </g>
        <g fill="none" strokeWidth="0.35" stroke="rgba(240,246,248,0.85)">
          <path d="M38.4 9.6 A2.3 1.5 0 0 1 42.4 9.6" />
          <path d="M39.8 7.4 A2.3 1.5 0 0 1 43.8 7.4" />
        </g>
        {/* 首を挟む口 */}
        <rect
          x={JAW.left}
          y={JAW.top + JAW_TOP_FACE}
          width={JAW.right - JAW.left}
          height={JAW.bottom - JAW.top - JAW_TOP_FACE}
          rx="0.8"
          fill={`url(#${ids.front})`}
        />
        <rect
          x={JAW.left + 0.4}
          y={JAW.top}
          width={JAW.right - JAW.left - 0.8}
          height={JAW_TOP_FACE + 0.3}
          rx="0.6"
          fill={`url(#${ids.top})`}
        />
        <rect
          x={JAW.left}
          y={JAW.top}
          width={JAW.right - JAW.left}
          height={JAW.bottom - JAW.top}
          rx="0.8"
          fill={`url(#${ids.leftLight})`}
        />
        <g style={{ mixBlendMode: "overlay" }} opacity="0.55">
          <path d={ARM_PATH} fill={`url(#${ids.grain})`} />
          <rect
            x={JAW.left}
            y={JAW.top}
            width={JAW.right - JAW.left}
            height={JAW.bottom - JAW.top}
            rx="0.8"
            fill={`url(#${ids.grain})`}
          />
        </g>
        {/* 上下2枚の板の合わせ目。下の板の上の角が光を受ける。 */}
        <path
          d={`M${JAW.left + 0.6} 14.6 H${JAW.right - 0.6}`}
          stroke="rgba(55,28,8,0.55)"
          strokeWidth="0.5"
        />
        <path
          d={`M${JAW.left + 0.6} 15.15 H${JAW.right - 0.6}`}
          stroke="rgba(255,236,200,0.5)"
          strokeWidth="0.3"
        />
        <path
          d={`M${JAW.left + 0.6} ${JAW.top + JAW_TOP_FACE + 0.1} H${JAW.right - 0.6}`}
          stroke="rgba(255,244,222,0.8)"
          strokeWidth="0.35"
        />
      </g>
    </svg>
  );
}
