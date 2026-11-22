import { useLayoutEffect, useRef } from "react";

import { getElixir } from "@/games/water-sort/ui/ideas/alchemy/alchemy-elixirs";
import { FINALE_FLARE_ATTRIBUTE } from "@/games/water-sort/ui/ideas/alchemy/alchemy-finale-targets";
import {
  SEALING_LIGHT_KEYFRAMES,
  SEALING_TIMELINE,
} from "@/games/water-sort/ui/ideas/alchemy/sealing-timeline";
import { prefersReducedMotion } from "@/lib/motion";

type FlaskHaloProps = {
  colorIndex: number;
  animate: boolean;
};

/** 内から灯った液が、フラスコのまわりへこぼす光。解いている間は隣のフラスコに掛からない幅にとどめ、仕上げでだけ大きく広げる。 */
export function FlaskHalo({ colorIndex, animate }: FlaskHaloProps) {
  const haloRef = useRef<HTMLSpanElement>(null);
  const { color } = getElixir(colorIndex);

  useLayoutEffect(() => {
    const halo = haloRef.current;
    if (!animate || !halo?.animate || prefersReducedMotion()) {
      return;
    }
    const animation = halo.animate(SEALING_LIGHT_KEYFRAMES, {
      duration: SEALING_TIMELINE.lightDurationMs,
      easing: "ease-out",
      fill: "backwards",
    });
    return () => animation.cancel();
  }, [animate]);

  return (
    <>
      <span
        ref={haloRef}
        className="absolute -inset-x-[22%] top-[6%] -bottom-[6%]"
        style={{
          backgroundImage: `radial-gradient(ellipse 50% 50% at 50% 60%, color-mix(in srgb, ${color} 70%, transparent) 0%, color-mix(in srgb, ${color} 30%, transparent) 60%, transparent 100%)`,
        }}
      />
      <span
        {...{ [FINALE_FLARE_ATTRIBUTE]: "" }}
        className="absolute -inset-x-[80%] -top-[12%] -bottom-[14%] opacity-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 50% 50% at 50% 58%, color-mix(in srgb, ${color} 55%, white 15%) 0%, color-mix(in srgb, ${color} 22%, transparent) 45%, transparent 100%)`,
        }}
      />
    </>
  );
}
