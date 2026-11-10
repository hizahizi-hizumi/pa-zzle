import { useId } from "react";

import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";
import { cn } from "@/lib/utils";

/** 波の印を1つ置く、横に2つ山を持つ短い線。`x`・`y` は左端。 */
function wavePath(x: number, y: number, size: number): string {
  const half = size / 2;
  return `M${x} ${y}q${half / 2} ${-half / 2} ${half} 0t${half} 0`;
}

/** 波の印を散らす1区画（px）。印の間を広く空け、動かない静かな水面に見せる。 */
const WAVE_TILE = { width: 96, height: 64 } as const;
const WAVE_SIZE = 14;
const WAVE_STROKE_WIDTH = 1.5;

/** プレイ画面の盤面の周りから、ブランドの帯と見出しの後ろまでを満たす海。 */
export function BridgesSea() {
  const patternId = useId();
  return (
    <div className={cn("relative size-full", bridgesToneClassNames.sea)}>
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <pattern
            id={patternId}
            width={WAVE_TILE.width}
            height={WAVE_TILE.height}
            patternUnits="userSpaceOnUse"
          >
            <g
              fill="none"
              strokeWidth={WAVE_STROKE_WIDTH}
              strokeLinecap="round"
              className={bridgesToneClassNames.seaWave}
            >
              <path d={wavePath(12, 18, WAVE_SIZE)} />
              <path d={wavePath(62, 50, WAVE_SIZE)} />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
