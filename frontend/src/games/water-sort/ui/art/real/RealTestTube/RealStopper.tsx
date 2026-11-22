import { type RefObject, useId } from "react";

import {
  NOISE_TILE_SIZE,
  SURFACE_GRAIN_URI,
} from "@/games/water-sort/ui/art/real/real-texture";
import { TUBE_VIEW_BOX } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

type RealStopperProps = {
  /** 栓を差し込む動きを、呼び出し側が動かすときに渡す。 */
  elementRef?: RefObject<SVGSVGElement | null>;
};

const TOP_Y = -2.4;
const TOP_RX = 11.4;
// 水平な円は、見下ろした角度の分だけ縦につぶれた楕円に見える（縦 = 横 × 0.12）。
const TOP_RY = TOP_RX * 0.12;
const BOTTOM_Y = 16.6;
const BOTTOM_RX = 9.2;
const BOTTOM_RY = BOTTOM_RX * 0.12;
const bodyPath = `M${18 - TOP_RX} ${TOP_Y} A${TOP_RX} ${TOP_RY} 0 0 0 ${18 + TOP_RX} ${TOP_Y} L${18 + BOTTOM_RX} ${BOTTOM_Y} A${BOTTOM_RX} ${BOTTOM_RY} 0 0 1 ${18 - BOTTOM_RX} ${BOTTOM_Y} Z`;
// 14本の盤面の試験管（幅 44px）では、試験管の座標の 1 が約 1.2px になる。そこで他の面と同じ細かさになる大きさで敷く。
const GRAIN_TILE = NOISE_TILE_SIZE / 1.2;

/** そろった試験管の口に差し込むゴム栓。光を返さないゴムなので、上の面が明るく、正面は左から右へ暗くなる。 */
export function RealStopper({ elementRef }: RealStopperProps) {
  const ids = {
    body: useId(),
    top: useId(),
    grain: useId(),
  };
  return (
    <svg
      ref={elementRef}
      data-rubber-stopper=""
      viewBox={TUBE_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full origin-[50%_6%] overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={ids.body} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a65642" />
          <stop offset="0.07" stopColor="#7c3326" />
          <stop offset="0.3" stopColor="#8a3d2d" />
          <stop offset="0.65" stopColor="#6a2a1f" />
          <stop offset="1" stopColor="#2c0f0b" />
        </linearGradient>
        <linearGradient id={ids.top} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d08a74" />
          <stop offset="0.5" stopColor="#b8705b" />
          <stop offset="1" stopColor="#8e4c3c" />
        </linearGradient>
        <pattern
          id={ids.grain}
          patternUnits="userSpaceOnUse"
          width={GRAIN_TILE}
          height={GRAIN_TILE}
        >
          <image
            href={SURFACE_GRAIN_URI}
            width={GRAIN_TILE}
            height={GRAIN_TILE}
          />
        </pattern>
      </defs>
      <path d={bodyPath} fill={`url(#${ids.body})`} />
      <ellipse
        cx="18"
        cy={TOP_Y}
        rx={TOP_RX}
        ry={TOP_RY}
        fill={`url(#${ids.top})`}
      />
      <g style={{ mixBlendMode: "overlay" }} opacity="0.12">
        <path d={bodyPath} fill={`url(#${ids.grain})`} />
      </g>
      {/* 上の面と正面の角が、上からの光を受ける */}
      <path
        d={`M${18 - TOP_RX + 0.4} ${TOP_Y + 0.1} A${TOP_RX} ${TOP_RY} 0 0 0 ${18 + TOP_RX - 0.4} ${TOP_Y + 0.1}`}
        fill="none"
        stroke="rgba(255,226,210,0.4)"
        strokeWidth="0.35"
      />
    </svg>
  );
}
