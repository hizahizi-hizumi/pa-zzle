import { type ReactNode, useEffect, useRef } from "react";

import { getGameResultStyle } from "@/components/game-result-style";
import type { GameResultLevel } from "@/games/result";

type GameResultMarkProps = {
  level: GameResultLevel;
  children: ReactNode;
};

export function GameResultMark({ level, children }: GameResultMarkProps) {
  const markRef = useRef<HTMLDivElement>(null);
  const style = getGameResultStyle(level);

  useEffect(() => {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      return;
    }

    markRef.current?.animate?.(
      [
        { transform: "scale(0.65) rotate(-8deg)", opacity: 0 },
        { transform: "scale(1.08) rotate(3deg)", opacity: 1, offset: 0.7 },
        { transform: "scale(1) rotate(0deg)", opacity: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }, []);

  return (
    <div
      ref={markRef}
      className={`mx-auto flex size-20 items-center justify-center rounded-full shadow-sm ${style.markClassName}`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
