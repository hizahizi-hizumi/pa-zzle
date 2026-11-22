import { useId } from "react";

import { WindowLight } from "@/games/water-sort/ui/ideas/kitchen/KitchenGround/WindowLight";
import { Worktable } from "@/games/water-sort/ui/ideas/kitchen/KitchenGround/Worktable";

/** 朝の台所の漆喰の壁と、手前の木の作業台。夜は電球の明かりの下の同じ台所。 */
export function KitchenGround() {
  const id = useId();
  const plasterId = `${id}-plaster`;

  return (
    <div className="relative size-full overflow-hidden bg-[#efe6d5] dark:bg-[#2b231c]">
      {/* 朝は窓の側（上）ほど明るく、夜は電球の下ほど明るい。 */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#f6efe2_0%,#efe6d5_45%,#e7dcc8_100%)] dark:bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,#4a3826_0%,#2b231c_70%)]" />
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full opacity-50 mix-blend-multiply dark:opacity-60 dark:mix-blend-soft-light"
      >
        <filter id={plasterId} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="4"
          />
          <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0.32 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${plasterId})`} />
      </svg>
      <WindowLight />
      <Worktable />
    </div>
  );
}
