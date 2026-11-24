import { useId } from "react";

import { fukumenzanToneClassNames } from "@/games/fukumenzan/ui/fukumenzan-tone";
import { cn } from "@/lib/utils";

/** 方眼の目の一辺と、罫線の交わる点の1つの位置（紙の左上から、px）。 */
export type FukumenzanGroundGrid = {
  cellPx: number;
  originXPx: number;
  originYPx: number;
};

const defaultGrid = {
  cellPx: 24,
  originXPx: 0,
  originYPx: 0,
} as const satisfies FukumenzanGroundGrid;

type FukumenzanGroundProps = {
  /** 方眼の目。渡さなければ、紙の左上から 24px の目にする。遊び方の図は、罫線を式のマスにそろえて渡す。 */
  grid?: FukumenzanGroundGrid;
};

/** 方眼の紙。罫線は動かさず、ブランドの帯と見出しの後ろまで同じ紙を敷く。 */
export function FukumenzanGround({
  grid = defaultGrid,
}: FukumenzanGroundProps) {
  const patternId = useId();
  const { cellPx, originXPx, originYPx } = grid;

  return (
    <div className={cn("relative size-full", fukumenzanToneClassNames.paper)}>
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <pattern
            id={patternId}
            x={originXPx}
            y={originYPx}
            width={cellPx}
            height={cellPx}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${cellPx} 0 H 0 V ${cellPx}`}
              fill="none"
              strokeWidth={1}
              className={fukumenzanToneClassNames.paperRule}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
