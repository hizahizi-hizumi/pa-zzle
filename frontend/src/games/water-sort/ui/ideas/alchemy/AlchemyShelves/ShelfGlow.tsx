import { useLayoutEffect, useRef } from "react";

import { POUR_ANIMATION_DURATION_MS } from "@/games/water-sort/ui/board/pour/pour-animation";
import { SEALING_TIMELINE } from "@/games/water-sort/ui/ideas/alchemy/sealing-timeline";
import { prefersReducedMotion } from "@/lib/motion";

type ShelfGlowProps = {
  centerX: number;
  bottom: number;
  flaskWidth: number;
  color: string;
};

/** 灯ったフラスコが棚に落とす光。盤面はそろった手の時点で変わるので、注ぎ終えて器が灯るのを待ってから灯す。 */
export function ShelfGlow({
  centerX,
  bottom,
  flaskWidth,
  color,
}: ShelfGlowProps) {
  const glowRef = useRef<SVGEllipseElement>(null);

  useLayoutEffect(() => {
    const glow = glowRef.current;
    if (!glow?.animate || prefersReducedMotion()) {
      return;
    }
    const animation = glow.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: SEALING_TIMELINE.lightDurationMs,
      delay: POUR_ANIMATION_DURATION_MS,
      easing: "ease-out",
      fill: "backwards",
    });
    return () => animation.cancel();
  }, []);

  return (
    <ellipse
      ref={glowRef}
      cx={centerX}
      cy={bottom + 3}
      rx={flaskWidth * 0.95}
      ry="8"
      fill={color}
      fillOpacity="0.62"
      style={{ filter: "blur(4px)" }}
    />
  );
}
