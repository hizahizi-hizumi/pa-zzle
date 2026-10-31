import { type ReactNode, useEffect, useRef } from "react";

import { playAnimations } from "@/lib/motion";

type TsumeShogiClearAnimationProps = {
  active: boolean;
  onClearAnimationComplete: () => void;
  children: ReactNode;
};

const matedKingSelector = "[data-mated-king]";

/** 詰めた手の駒が着いてから、玉を揺らし始めるまで。 */
const CLEAR_START_DELAY_MS = 260;
const CLEAR_SHAKE_DURATION_MS = 520;
const CLEAR_SHAKE_EASING = "ease-out";
/** 揺れが収まった詰み上がりの盤を見せる時間。 */
const CLEAR_SETTLE_MS = 700;
/** 揺らさないときも、揺らしたときと同じ間だけ詰み上がりを見せる。 */
const CLEAR_STILL_HOLD_MS =
  CLEAR_START_DELAY_MS + CLEAR_SHAKE_DURATION_MS + CLEAR_SETTLE_MS;

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
  onClearAnimationComplete,
  children,
}: TsumeShogiClearAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    return playAnimations({
      animate() {
        const king = containerRef.current?.querySelector<HTMLElement>(
          `${matedKingSelector} > span`,
        );
        const animation = king?.animate?.(matedKingKeyframes, {
          duration: CLEAR_SHAKE_DURATION_MS,
          delay: CLEAR_START_DELAY_MS,
          easing: CLEAR_SHAKE_EASING,
        });
        return animation ? [animation] : [];
      },
      completion: { type: "after-animations", holdMs: CLEAR_SETTLE_MS },
      reducedMotionHoldMs: CLEAR_STILL_HOLD_MS,
      unanimatedHoldMs: CLEAR_STILL_HOLD_MS,
      onFinished: onClearAnimationComplete,
    });
  }, [active, onClearAnimationComplete]);

  return (
    <div ref={containerRef} className="size-full">
      {children}
    </div>
  );
}
