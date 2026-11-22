import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion";

type Firefly = {
  left: string;
  top: string;
  durationMs: number;
  delayMs: number;
};

const fireflies: readonly Firefly[] = [
  { left: "18%", top: "35%", durationMs: 5200, delayMs: 0 },
  { left: "63%", top: "60%", durationMs: 6800, delayMs: 2100 },
  { left: "86%", top: "25%", durationMs: 6000, delayMs: 3900 },
];

const glowKeyframes: Keyframe[] = [
  { opacity: 0.15 },
  { opacity: 0.15, offset: 0.4 },
  { opacity: 0.9, offset: 0.55 },
  { opacity: 0.15, offset: 0.75 },
  { opacity: 0.15 },
];

/** すだれの下からのぞく夜の庭で、蛍がごくゆっくり明滅する。 */
export function Fireflies() {
  const refs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }
    const animations = fireflies.flatMap((firefly, index) => {
      const animation = refs.current[index]?.animate?.(glowKeyframes, {
        duration: firefly.durationMs,
        delay: firefly.delayMs,
        iterations: Number.POSITIVE_INFINITY,
        easing: "ease-in-out",
      });
      return animation ? [animation] : [];
    });
    return () => {
      for (const animation of animations) {
        animation.cancel();
      }
    };
  }, []);

  return (
    <div aria-hidden="true" className="absolute inset-0 hidden dark:block">
      {fireflies.map((firefly, index) => (
        <span
          key={firefly.left}
          ref={(element) => {
            refs.current[index] = element;
          }}
          className="absolute size-[3px] rounded-full bg-[#e9ff9a] opacity-30 shadow-[0_0_6px_2px_rgba(214,255,120,0.55)] will-change-[opacity]"
          style={{ left: firefly.left, top: firefly.top }}
        />
      ))}
    </div>
  );
}
