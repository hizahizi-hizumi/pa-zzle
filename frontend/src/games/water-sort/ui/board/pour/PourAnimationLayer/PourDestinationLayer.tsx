import { useLayoutEffect, useRef } from "react";
import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
  pourDuration,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { AnimatedDestinationTransfer } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestinationLayer/AnimatedDestinationTransfer";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import { paintGlassBottle } from "@/games/water-sort/ui/board/water-bottle/glass-bottle-renderer";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";

type PourDestinationLayerProps = {
  appearance: WaterSortAppearance;
  animations: readonly PourAnimation[];
};

export function PourDestinationLayer({
  appearance,
  animations,
}: PourDestinationLayerProps) {
  const destinationRef = useRef<HTMLDivElement>(null);
  const firstAnimation = animations[0];
  const lastAnimation = animations.at(-1);
  useLayoutEffect(() => {
    if (appearance !== "glass" || !firstAnimation || !lastAnimation) return;
    const canvas = destinationRef.current?.querySelector<HTMLCanvasElement>(
      "[data-water-sort-glass]",
    );
    if (!canvas) return;
    const initialLength = firstAnimation.destination.before.length;
    const finalLength = lastAnimation.destination.after.length;
    const beganAt = performance.now();
    let frameRequest = 0;
    const render = (time: number) => {
      const progress = Math.min(1, (time - beganAt) / pourDuration(appearance));
      const transfer = Math.max(
        0,
        Math.min(
          1,
          (progress - POUR_TRANSFER_START_OFFSET) /
            (POUR_TRANSFER_END_OFFSET - POUR_TRANSFER_START_OFFSET),
        ),
      );
      paintGlassBottle(canvas, {
        contents: lastAnimation.destination.after,
        amount: initialLength + (finalLength - initialLength) * transfer,
        ripples: transfer,
        completion:
          progress >= POUR_TRANSFER_END_OFFSET &&
          lastAnimation.destination.after.length === 4 &&
          lastAnimation.destination.after.every(
            (color) => color === lastAnimation.destination.after[0],
          )
            ? (progress - POUR_TRANSFER_END_OFFSET) /
              (1 - POUR_TRANSFER_END_OFFSET)
            : 0,
      });
      if (progress < 1) frameRequest = requestAnimationFrame(render);
    };
    render(beganAt);
    frameRequest = requestAnimationFrame(render);
    const completed =
      lastAnimation.destination.before.length < 4 &&
      lastAnimation.destination.after.length === 4 &&
      lastAnimation.destination.after.every(
        (color) => color === lastAnimation.destination.after[0],
      );
    const settleAnimation = completed
      ? destinationRef.current?.animate?.(
          [
            { transform: "translateY(0) scale(1)", offset: 0.7 },
            {
              transform: "translateY(-3px) scale(1.035)",
              offset: 0.82,
              easing: "ease-out",
            },
            { transform: "translateY(0) scale(1)", offset: 1 },
          ],
          { duration: pourDuration(appearance), easing: "ease-in-out" },
        )
      : null;
    return () => {
      cancelAnimationFrame(frameRequest);
      settleAnimation?.cancel();
    };
  }, [appearance, firstAnimation, lastAnimation]);
  if (!firstAnimation) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      ref={destinationRef}
      className="pointer-events-none fixed aspect-[0.36] origin-bottom rounded-b-[1.45rem]"
      style={getOverlayStyle(
        firstAnimation.destination.rect,
        POUR_LAYER_ORDER.destination,
      )}
    >
      <WaterBottle
        appearance={appearance}
        contents={
          appearance === "glass"
            ? (lastAnimation?.destination.after ??
              firstAnimation.destination.before)
            : firstAnimation.destination.before
        }
        waterOverlay={
          appearance === "glass"
            ? undefined
            : animations.map((animation) => (
                <AnimatedDestinationTransfer
                  appearance={appearance}
                  key={animation.id}
                  animation={animation}
                />
              ))
        }
      />
    </div>
  );
}
