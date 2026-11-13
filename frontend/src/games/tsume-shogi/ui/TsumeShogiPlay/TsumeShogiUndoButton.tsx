import { type Ref, useImperativeHandle, useLayoutEffect, useRef } from "react";

import { UndoButton } from "@/components/UndoButton";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import {
  playRejectionShake,
  prefersReducedMotion,
  type RejectionShakeTiming,
} from "@/lib/motion";

/** 待ったへ目を向けさせる一度だけの弾み。 */
const attentionBounceKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.25)", offset: 0.35 },
  { transform: "scale(0.95)", offset: 0.7 },
  { transform: "scale(1)" },
];
const ATTENTION_BOUNCE_DURATION_MS = 420;
const ATTENTION_BOUNCE_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/** 指せる操作は待っただけだと返す揺れ。待ったの大きさに対して大きく振る。 */
const nudgeShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-9px) rotate(-8deg)" },
  { transform: "translateX(9px) rotate(8deg)" },
  { transform: "translateX(-7px) rotate(-6deg)" },
  { transform: "translateX(7px) rotate(6deg)" },
  { transform: "translateX(-3px)" },
  { transform: "translateX(0)" },
];
const nudgeShakeTiming: RejectionShakeTiming = {
  durationMs: 420,
  easing: "ease-in-out",
};

export type TsumeShogiUndoButtonHandle = {
  /** 待った以外の操作が通らなかったことを、待ったを揺らして返す。 */
  nudge: () => void;
};

type TsumeShogiUndoButtonProps = {
  disabled: boolean;
  /** この手数では詰まなくなった間。待ったを朱の輪で囲み、囲み始めに一度弾ませる。 */
  attention: boolean;
  onUndo: () => void;
  ref?: Ref<TsumeShogiUndoButtonHandle>;
};

export function TsumeShogiUndoButton({
  disabled,
  attention,
  onUndo,
  ref,
}: TsumeShogiUndoButtonProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    nudge() {
      playRejectionShake(
        containerRef.current,
        nudgeShakeKeyframes,
        nudgeShakeTiming,
      );
    },
  }));

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (
      !attention ||
      typeof container?.animate !== "function" ||
      prefersReducedMotion()
    ) {
      return;
    }
    container.animate(attentionBounceKeyframes, {
      duration: ATTENTION_BOUNCE_DURATION_MS,
      easing: ATTENTION_BOUNCE_EASING,
    });
  }, [attention]);

  return (
    <span ref={containerRef} className="relative inline-flex rounded-full">
      <UndoButton disabled={disabled} onUndo={onUndo} />
      {attention && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-1.5 rounded-full ${tsumeShogiToneClassNames.undoAttentionRing}`}
        />
      )}
    </span>
  );
}
