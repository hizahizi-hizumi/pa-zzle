import { useId } from "react";

import { fukumenzanToneClassNames } from "@/games/fukumenzan/ui/fukumenzan-tone";
import { cn } from "@/lib/utils";

const GRID_PX = 24;

/** 方眼の紙。罫線は動かさず、ブランドの帯と見出しの後ろまで同じ紙を敷く。 */
export function FukumenzanGround() {
  const patternId = useId();

  return (
    <div className={cn("relative size-full", fukumenzanToneClassNames.paper)}>
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <pattern
            id={patternId}
            width={GRID_PX}
            height={GRID_PX}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID_PX} 0 H 0 V ${GRID_PX}`}
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
