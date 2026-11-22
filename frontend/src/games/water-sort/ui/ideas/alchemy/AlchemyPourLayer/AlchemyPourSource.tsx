import { useEffect, useRef } from "react";

import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
  POUR_LINEAR_EASING,
  POUR_SOURCE_LIFT_EASING,
  POUR_SOURCE_POUR_EASING,
  POUR_SOURCE_TRAVEL_EASING,
  POUR_TILT_EASING,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { AlchemyFlask } from "@/games/water-sort/ui/ideas/alchemy/AlchemyFlask";
import { getElixir } from "@/games/water-sort/ui/ideas/alchemy/alchemy-elixirs";
import { ElixirBand } from "@/games/water-sort/ui/ideas/alchemy/ElixirBand";
import {
  FLASK_LIQUID_INSET,
  getFlaskShape,
} from "@/games/water-sort/ui/ideas/alchemy/flask-shapes";
import { playAnimations } from "@/lib/motion";

type AlchemyPourSourceProps = {
  animation: PourAnimation;
  onFinish: (animationId: number) => void;
};

const TILT_DEGREES = 68;
/** 糸が伸びきる所と、注ぎ口から切れて落ちきる所（動きの長さに対する割合）。 */
const THREAD_REACHED_OFFSET = 0.41;
const THREAD_DETACH_OFFSET = 0.7;
const THREAD_FALLEN_OFFSET = 0.8;

export function AlchemyPourSource({
  animation,
  onFinish,
}: AlchemyPourSourceProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const transferRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sourceElement = sourceRef.current;
    if (!sourceElement?.animate) {
      onFinish(animation.id);
      return;
    }

    const { rect: sourceRect, liftY } = animation.source;
    const { rect: destinationRect } = animation.destination;
    const deltaX = destinationRect.left - sourceRect.left;
    const deltaY = destinationRect.top - sourceRect.top;
    const hoverY = deltaY - sourceRect.height * 0.55;
    const direction = deltaX >= 0 ? 1 : -1;
    const timing = {
      duration: POUR_ANIMATION_DURATION_MS,
      easing: POUR_LINEAR_EASING,
    };
    let threadAnimation: Animation | undefined;
    let transferAnimation: Animation | undefined;

    const cancelSource = playAnimations({
      animate() {
        const sourceAnimation = sourceElement.animate(
          [
            {
              transform: `translate(0, ${liftY}px) rotate(0deg)`,
              offset: 0,
              easing: POUR_SOURCE_LIFT_EASING,
            },
            {
              transform: `translate(0, ${liftY - 4}px) rotate(0deg)`,
              offset: 0.06,
              easing: POUR_TILT_EASING,
            },
            {
              transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
              offset: 0.2,
              easing: POUR_SOURCE_TRAVEL_EASING,
            },
            {
              transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * TILT_DEGREES}deg)`,
              offset: 0.32,
              easing: POUR_SOURCE_LIFT_EASING,
            },
            {
              transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * TILT_DEGREES}deg)`,
              offset: 0.76,
              easing: POUR_SOURCE_POUR_EASING,
            },
            {
              transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
              offset: 0.86,
              easing: POUR_TILT_EASING,
            },
            { transform: "translate(0, 0) rotate(0deg)", offset: 1 },
          ],
          timing,
        );

        threadAnimation = threadRef.current?.animate?.(
          [
            { clipPath: "inset(0 0 100% 0)", opacity: 0, offset: 0 },
            {
              clipPath: "inset(0 0 100% 0)",
              opacity: 1,
              offset: POUR_TRANSFER_START_OFFSET - 0.05,
              easing: "ease-in",
            },
            {
              clipPath: "inset(0 0 0% 0)",
              opacity: 1,
              offset: THREAD_REACHED_OFFSET,
            },
            {
              clipPath: "inset(0% 0 0 0)",
              opacity: 1,
              offset: THREAD_DETACH_OFFSET,
              easing: "ease-in",
            },
            {
              clipPath: "inset(100% 0 0 0)",
              opacity: 1,
              offset: THREAD_FALLEN_OFFSET,
            },
            { clipPath: "inset(100% 0 0 0)", opacity: 0, offset: 1 },
          ],
          timing,
        );

        transferAnimation = transferRef.current?.animate?.(
          [
            { transform: "scaleY(1)", offset: 0 },
            { transform: "scaleY(1)", offset: POUR_TRANSFER_START_OFFSET },
            { transform: "scaleY(0)", offset: POUR_TRANSFER_END_OFFSET },
            { transform: "scaleY(0)", offset: 1 },
          ],
          { ...timing, fill: "forwards" },
        );

        return [sourceAnimation];
      },
      completion: { type: "after-animations", holdMs: 0 },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished() {
        onFinish(animation.id);
      },
    });

    return () => {
      cancelSource();
      threadAnimation?.cancel();
      transferAnimation?.cancel();
    };
  }, [onFinish, animation]);

  return (
    <>
      <div
        ref={sourceRef}
        aria-hidden="true"
        className="pointer-events-none fixed origin-top will-change-transform"
        style={getOverlayStyle(animation.source.rect, POUR_LAYER_ORDER.source)}
      >
        <AlchemyFlask
          contents={animation.source.after}
          shape={getFlaskShape(animation.source.bottleIndex)}
          selected
          liquidOverlay={
            <ElixirBand
              colorIndex={animation.colorIndex}
              startSlot={animation.source.after.length}
              slotCount={
                animation.source.before.length - animation.source.after.length
              }
              bandRef={transferRef}
              initialScaleY={1}
            />
          }
        />
      </div>
      <div
        ref={threadRef}
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full opacity-0 will-change-[clip-path]"
        style={getThreadStyle(animation)}
      />
    </>
  );
}

/** 注ぎ先の口の上から、注ぎ先で液が溜まり終える面まで落ちる霊液の糸。 */
function getThreadStyle(animation: PourAnimation) {
  const { rect: sourceRect } = animation.source;
  const { rect: destinationRect } = animation.destination;
  const { color, threadWidthPx } = getElixir(animation.colorIndex);
  const top = destinationRect.top - sourceRect.height * 0.55 + 3;
  const liquidTop = FLASK_LIQUID_INSET.topPercent / 100;
  const liquidHeight =
    1 -
    FLASK_LIQUID_INSET.topPercent / 100 -
    FLASK_LIQUID_INSET.bottomPercent / 100;
  const surfaceY =
    destinationRect.top +
    destinationRect.height *
      (liquidTop + liquidHeight * (1 - animation.destination.after.length / 4));
  return {
    left: `${destinationRect.left + destinationRect.width / 2 - threadWidthPx / 2}px`,
    top: `${top}px`,
    width: `${threadWidthPx}px`,
    height: `${Math.max(0, surfaceY - top)}px`,
    backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${color} 70%, black) 0%, color-mix(in srgb, ${color} 55%, white) 45%, ${color} 70%, color-mix(in srgb, ${color} 65%, black) 100%)`,
    boxShadow: `0 0 4px color-mix(in srgb, ${color} 45%, transparent)`,
    zIndex: POUR_LAYER_ORDER.stream,
  };
}
