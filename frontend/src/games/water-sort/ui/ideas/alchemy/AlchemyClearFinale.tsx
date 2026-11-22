import { useEffect, useEffectEvent } from "react";

import {
  FINALE_DAWN_ATTRIBUTE,
  FINALE_FLARE_ATTRIBUTE,
} from "@/games/water-sort/ui/ideas/alchemy/alchemy-finale-targets";
import { FINALE_TIMELINE } from "@/games/water-sort/ui/ideas/alchemy/finale-timeline";
import type { ClearFinaleProps } from "@/games/water-sort/ui/ideas/overrides";
import { playAnimations, prefersReducedMotion } from "@/lib/motion";

const FLARE_KEYFRAMES: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: 0.35 },
  { opacity: 0.8 },
];

/** 全部そろうと、フラスコが左から順に灯り、工房が明るむ。触れると結果へ進む。 */
export function AlchemyClearFinale({
  getBottleElements,
  onDone,
}: ClearFinaleProps) {
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const flares = getBottleElements().map((bottle) =>
      Array.from(
        bottle.querySelectorAll<HTMLElement>(`[${FINALE_FLARE_ATTRIBUTE}]`),
      ),
    );
    const dawn = document.querySelector<HTMLElement>(
      `[${FINALE_DAWN_ATTRIBUTE}]`,
    );
    const lit = [...flares.flat(), ...(dawn ? [dawn] : [])];

    if (prefersReducedMotion()) {
      for (const element of lit) {
        element.style.opacity = "0.8";
      }
    }
    const stagger = FINALE_TIMELINE.flareSpreadMs / Math.max(1, flares.length);
    const cancel = playAnimations({
      animate() {
        const flareAnimations = flares.flatMap((elements, index) =>
          elements.flatMap(
            (element) =>
              element.animate?.(FLARE_KEYFRAMES, {
                duration: FINALE_TIMELINE.flareDurationMs,
                delay: FINALE_TIMELINE.flareStartMs + stagger * index,
                easing: "ease-out",
                fill: "forwards",
              }) ?? [],
          ),
        );
        const dawnAnimation = dawn?.animate?.(
          [{ opacity: 0 }, { opacity: 1 }],
          {
            duration: FINALE_TIMELINE.dawnDurationMs,
            delay: FINALE_TIMELINE.dawnStartMs,
            easing: "ease-in-out",
            fill: "forwards",
          },
        );
        return [...flareAnimations, ...(dawnAnimation ? [dawnAnimation] : [])];
      },
      completion: {
        type: "after-duration",
        durationMs: FINALE_TIMELINE.doneMs,
      },
      reducedMotionHoldMs: FINALE_TIMELINE.reducedMotionHoldMs,
      unanimatedHoldMs: FINALE_TIMELINE.reducedMotionHoldMs,
      onFinished: finish,
    });

    return () => {
      cancel();
      for (const element of lit) {
        element.style.opacity = "";
      }
    };
  }, [getBottleElements]);

  return (
    <button
      type="button"
      aria-label="結果へ進む"
      className="fixed inset-0 z-10 cursor-pointer"
      onClick={onDone}
    />
  );
}
