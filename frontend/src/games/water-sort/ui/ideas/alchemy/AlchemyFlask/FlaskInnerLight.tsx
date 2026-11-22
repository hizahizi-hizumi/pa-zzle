import { useLayoutEffect, useRef } from "react";

import { FINALE_FLARE_ATTRIBUTE } from "@/games/water-sort/ui/ideas/alchemy/alchemy-finale-targets";
import {
  SEALING_LIGHT_KEYFRAMES,
  SEALING_TIMELINE,
} from "@/games/water-sort/ui/ideas/alchemy/sealing-timeline";
import { prefersReducedMotion } from "@/lib/motion";

type FlaskInnerLightProps = {
  animate: boolean;
};

/** そろって純粋な精に還った液が、芯から灯る光。 */
export function FlaskInnerLight({ animate }: FlaskInnerLightProps) {
  const lightRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const light = lightRef.current;
    if (!animate || !light?.animate || prefersReducedMotion()) {
      return;
    }
    const animation = light.animate(SEALING_LIGHT_KEYFRAMES, {
      duration: SEALING_TIMELINE.lightDurationMs,
      easing: "ease-out",
      fill: "backwards",
    });
    return () => animation.cancel();
  }, [animate]);

  return (
    <>
      <span
        ref={lightRef}
        className="absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 58% 46% at 44% 52%, rgba(255, 248, 222, 0.62) 0%, rgba(255, 240, 200, 0.18) 55%, rgba(255, 240, 200, 0) 85%)",
        }}
      />
      <span
        {...{ [FINALE_FLARE_ATTRIBUTE]: "" }}
        className="absolute inset-0 opacity-0 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 45% 50%, rgba(255, 250, 230, 0.42) 0%, rgba(255, 244, 210, 0.16) 60%, rgba(255, 244, 210, 0.04) 100%)",
        }}
      />
    </>
  );
}
