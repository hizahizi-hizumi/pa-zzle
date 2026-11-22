import { useId } from "react";

import {
  JAR_INNER_PATH,
  JAR_VIEW_BOX,
} from "@/games/water-sort/ui/ideas/kitchen/jar-geometry";

/** 液の後ろに見えるガラスの奥側。空の瓶でもガラスの器だと分かるよう、内側をわずかに明るくする。 */
export function JarGlassBack() {
  const id = useId();
  const tintId = `${id}-tint`;

  return (
    <svg
      viewBox={JAR_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
    >
      <defs>
        <linearGradient id={tintId} x1="0" x2="1" y1="0" y2="0">
          <stop
            offset="0"
            className="[stop-color:#ffffff] [stop-opacity:0.16] dark:[stop-color:#ffd9a0] dark:[stop-opacity:0.1]"
          />
          <stop
            offset="0.45"
            className="[stop-color:#ffffff] [stop-opacity:0] dark:[stop-color:#ffd9a0] dark:[stop-opacity:0.04]"
          />
          <stop
            offset="1"
            className="[stop-color:#9fbcb1] [stop-opacity:0.14] dark:[stop-color:#ffd9a0] dark:[stop-opacity:0.12]"
          />
        </linearGradient>
      </defs>
      <path d={JAR_INNER_PATH} fill={`url(#${tintId})`} />
      {/* 口の奥の縁。見下ろす角度で、口が楕円に見える。 */}
      <path
        d="M6.6 5.4 C 8 3.6, 28 3.6, 29.4 5.4"
        fill="none"
        strokeWidth="0.9"
        className="stroke-[#7d958e]/60 dark:stroke-[#e2c79a]/40"
      />
    </svg>
  );
}
