import { type ReactNode, useEffect, useRef } from "react";

type TsumeShogiClearAnimationProps = {
  active: boolean;
  onComplete: () => void;
  children: ReactNode;
};

const matedKingSelector = "[data-mated-king]";

/** 詰めた手の駒が着いてから、玉を揺らし始めるまで。 */
const CLEAR_START_DELAY_MS = 260;
const CLEAR_SHAKE_DURATION_MS = 520;
/** 揺れが収まった詰み上がりの盤を見せる時間。 */
const CLEAR_SETTLE_MS = 700;

const matedKingKeyframes: Keyframe[] = [
  { transform: "scale(1) rotate(0deg)" },
  { transform: "scale(1.12) rotate(-6deg)", offset: 0.2 },
  { transform: "scale(1.12) rotate(6deg)", offset: 0.45 },
  { transform: "scale(1.08) rotate(-3deg)", offset: 0.7 },
  { transform: "scale(1) rotate(0deg)" },
];

/**
 * 詰んだ瞬間に入力を止め、詰んだ玉の升を染めて玉を小さく揺らし、詰み上がりの盤を少し見せてから結果へ進める。
 * 動きを減らす設定では揺らさず、同じ間だけ詰み上がりを見せる。
 */
export function TsumeShogiClearAnimation({
  active,
  onComplete,
  children,
}: TsumeShogiClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const king = containerRef.current?.querySelector<HTMLElement>(
      `${matedKingSelector} > span`,
    );
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animation =
      king && !reducedMotion && typeof king.animate === "function"
        ? king.animate(matedKingKeyframes, {
            duration: CLEAR_SHAKE_DURATION_MS,
            delay: CLEAR_START_DELAY_MS,
            easing: "ease-out",
          })
        : null;
    const timer = window.setTimeout(
      onComplete,
      CLEAR_START_DELAY_MS + CLEAR_SHAKE_DURATION_MS + CLEAR_SETTLE_MS,
    );

    return () => {
      window.clearTimeout(timer);
      animation?.cancel();
    };
  }, [active, onComplete]);

  return (
    <div ref={containerRef} className="size-full">
      {children}
    </div>
  );
}
