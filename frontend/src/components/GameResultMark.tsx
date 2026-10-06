import { type ReactNode, useEffect, useRef } from "react";

import { getGameResultStyle } from "@/components/game-result-style";
import type { GameResultLevel } from "@/games/result";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

type GameResultMarkProps = {
  level: GameResultLevel;
  children: ReactNode;
};

const MARK_REVEAL_MS = 520;

const markRevealKeyframes: Keyframe[] = [
  { transform: "scale(0.65) rotate(-8deg)", opacity: 0 },
  { transform: "scale(1.08) rotate(3deg)", opacity: 1, offset: 0.7 },
  { transform: "scale(1) rotate(0deg)", opacity: 1 },
];

export function GameResultMark({ level, children }: GameResultMarkProps) {
  const markRef = useRef<HTMLDivElement>(null);
  const style = getGameResultStyle(level);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    markRef.current?.animate?.(markRevealKeyframes, {
      duration: MARK_REVEAL_MS,
      easing: MOTION_EASING.celebrate,
    });
  }, []);

  return (
    <div
      ref={markRef}
      className={`mx-auto flex size-20 items-center justify-center rounded-full shadow-raised ${style.markClassName}`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
