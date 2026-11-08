import { useEffect, useRef } from "react";
import {
  getOverlayStyle,
  getPourStreamStyle,
  POUR_ANIMATION_DURATION_MS,
  POUR_LAYER_ORDER,
  POUR_TILT_EASING,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { TransferLiquidView } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/TransferLiquidView";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import { paintGlassBottle } from "@/games/water-sort/ui/board/water-bottle/glass-bottle-renderer";
import { WaterBottle } from "@/games/water-sort/ui/board/water-bottle/WaterBottle";
import { waitForAnimations } from "@/lib/motion";

type PourSourceLayerProps = {
  appearance: WaterSortAppearance;
  animation: PourAnimation;
  onFinish: (animationId: number) => void;
};

export function PourSourceLayer({
  appearance,
  animation,
  onFinish,
}: PourSourceLayerProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const sourceTransferRef = useRef<HTMLSpanElement>(null);
  const animationAppearance = useRef(appearance);

  useEffect(() => {
    const sourceElement = sourceRef.current;
    const streamElement = streamRef.current;
    if (!sourceElement?.animate) {
      onFinish(animation.id);
      return;
    }

    const { rect: sourceRect } = animation.source;
    const { rect: destinationRect } = animation.destination;
    const deltaX = destinationRect.left - sourceRect.left;
    const deltaY = destinationRect.top - sourceRect.top;
    const hoverY = deltaY - sourceRect.height * 0.55;
    const direction = deltaX >= 0 ? 1 : -1;
    const sourceTransferElement = sourceTransferRef.current;

    const initialTransform = animation.gesture
      ? `translate(${animation.gesture.offsetX}px, ${animation.gesture.offsetY}px) rotate(${animation.gesture.tiltDegrees}deg)`
      : "translate(0, 0) rotate(0deg)";
    const sourceAnimation = sourceElement.animate(
      [
        {
          transform: initialTransform,
          offset: 0,
          easing: "ease-out",
        },
        {
          transform: animation.gesture
            ? initialTransform
            : "translate(0, -4px) rotate(0deg)",
          offset: 0.06,
          easing: POUR_TILT_EASING,
        },
        {
          transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
          offset: 0.2,
          easing: "ease-in-out",
        },
        {
          transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * 68}deg)`,
          offset: 0.32,
          easing: "ease-out",
        },
        {
          transform: `translate(${deltaX}px, ${hoverY}px) rotate(${direction * 68}deg)`,
          offset: 0.76,
          easing: "ease-in",
        },
        {
          transform: `translate(${deltaX}px, ${hoverY}px) rotate(0deg)`,
          offset: 0.86,
          easing: POUR_TILT_EASING,
        },
        { transform: "translate(0, 0) rotate(0deg)", offset: 1 },
      ],
      {
        duration: POUR_ANIMATION_DURATION_MS,
        easing: "linear",
      },
    );

    const canvas = sourceElement.querySelector<HTMLCanvasElement>(
      "[data-water-sort-glass]",
    );
    let frameRequest = 0;
    if (canvas && animationAppearance.current === "glass") {
      const amountBefore = animation.source.before.length;
      const amountAfter = animation.source.after.length;
      const startAt = performance.now();
      const render = (time: number) => {
        const progress = Math.min(
          1,
          (time - startAt) / POUR_ANIMATION_DURATION_MS,
        );
        const transfer = Math.max(
          0,
          Math.min(
            1,
            (progress - POUR_TRANSFER_START_OFFSET) /
              (POUR_TRANSFER_END_OFFSET - POUR_TRANSFER_START_OFFSET),
          ),
        );
        const rotation = new DOMMatrixReadOnly(
          getComputedStyle(sourceElement).transform,
        );
        paintGlassBottle(canvas, {
          contents: animation.source.before,
          amount: amountBefore + (amountAfter - amountBefore) * transfer,
          tiltDegrees: (Math.atan2(rotation.b, rotation.a) * 180) / Math.PI,
        });
        if (progress < 1) frameRequest = requestAnimationFrame(render);
      };
      render(startAt);
      frameRequest = requestAnimationFrame(render);
    }

    const streamAnimation = streamElement?.animate?.(
      [
        { opacity: 0, transform: "scaleY(0.15)", offset: 0 },
        { opacity: 0, transform: "scaleY(0.15)", offset: 0.32 },
        {
          opacity: 0.9,
          transform: "scaleY(1)",
          offset: POUR_TRANSFER_START_OFFSET,
        },
        { opacity: 0.9, transform: "scaleY(1)", offset: 0.7 },
        { opacity: 0, transform: "scaleY(0.35)", offset: 0.77 },
        { opacity: 0, transform: "scaleY(0.15)", offset: 1 },
      ],
      { duration: POUR_ANIMATION_DURATION_MS, easing: "linear" },
    );

    const sourceTransferAnimation = sourceTransferElement?.animate?.(
      [
        { transform: "scaleY(1)", offset: 0 },
        { transform: "scaleY(1)", offset: POUR_TRANSFER_START_OFFSET },
        { transform: "scaleY(0)", offset: POUR_TRANSFER_END_OFFSET },
        { transform: "scaleY(0)", offset: 1 },
      ],
      {
        duration: POUR_ANIMATION_DURATION_MS,
        easing: "linear",
        fill: "forwards",
      },
    );

    const stopWaiting = waitForAnimations([sourceAnimation], function finish() {
      onFinish(animation.id);
    });

    return () => {
      stopWaiting();
      sourceAnimation.cancel();
      cancelAnimationFrame(frameRequest);
      streamAnimation?.cancel();
      sourceTransferAnimation?.cancel();
    };
  }, [onFinish, animation]);

  return (
    <>
      <div
        ref={sourceRef}
        aria-hidden="true"
        className="pointer-events-none fixed aspect-[0.36] origin-top rounded-b-[1.45rem] will-change-transform"
        style={getOverlayStyle(animation.source.rect, POUR_LAYER_ORDER.source)}
      >
        <WaterBottle
          appearance={appearance}
          contents={
            appearance === "glass"
              ? animation.source.before
              : animation.source.after
          }
          waterOverlay={
            appearance === "glass" ? undefined : (
              <TransferLiquidView
                appearance={appearance}
                transfer={{
                  colorIndex: animation.colorIndex,
                  startSlot: animation.source.after.length,
                  slotCount:
                    animation.source.before.length -
                    animation.source.after.length,
                  elementRef: sourceTransferRef,
                  initialScaleY: 1,
                }}
              />
            )
          }
        />
      </div>
      <div
        ref={streamRef}
        aria-hidden="true"
        className="water-sort-pour-stream pointer-events-none fixed origin-top rounded-full opacity-0 will-change-transform"
        data-appearance={appearance}
        style={getPourStreamStyle(animation)}
      />
    </>
  );
}
