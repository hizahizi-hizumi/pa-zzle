import { type ReactNode, useEffect, useRef } from "react";

type MinesweeperClearAnimationProps = {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

/** クリアを決めた最終操作と、明かした地雷配置を見せてから結果へ進める。 */
export function MinesweeperClearAnimation({
  active,
  onComplete,
  children,
}: MinesweeperClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onComplete();
      return;
    }

    const animation = containerRef.current?.animate?.(
      [
        { transform: "scale(1)", filter: "saturate(1)" },
        {
          transform: "scale(1.014)",
          filter: "saturate(1.24)",
          offset: 0.5,
        },
        { transform: "scale(1)", filter: "saturate(1)" },
      ],
      { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" },
    );

    if (!animation) {
      const timer = window.setTimeout(onComplete, 900);
      return () => window.clearTimeout(timer);
    }

    let settleTimer: number | undefined;
    animation.onfinish = () => {
      settleTimer = window.setTimeout(onComplete, 200);
    };
    return () => {
      animation.cancel();
      if (settleTimer !== undefined) {
        window.clearTimeout(settleTimer);
      }
    };
  }, [active, onComplete]);

  return (
    <div ref={containerRef} className="relative">
      {children}
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-violet-200/15 dark:bg-violet-700/10"
        />
      )}
    </div>
  );
}
