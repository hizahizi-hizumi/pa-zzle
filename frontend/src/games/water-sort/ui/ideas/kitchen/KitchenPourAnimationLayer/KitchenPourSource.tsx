import { useEffect, useRef } from "react";

import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { getSyrupSurfaceRatio } from "@/games/water-sort/ui/ideas/kitchen/jar-geometry";
import { KitchenJar } from "@/games/water-sort/ui/ideas/kitchen/KitchenJar";
import { SyrupTransfer } from "@/games/water-sort/ui/ideas/kitchen/KitchenPourAnimationLayer/SyrupTransfer";
import {
  KITCHEN_POUR_DURATION_MS,
  KITCHEN_POUR_TRANSFER_END,
  KITCHEN_POUR_TRANSFER_START,
} from "@/games/water-sort/ui/ideas/kitchen/kitchen-pour-timing";
import { getSyrupStreamStyle } from "@/games/water-sort/ui/ideas/kitchen/kitchen-syrups";
import { playAnimations } from "@/lib/motion";

/** 口の広い瓶は、深く傾けなくても注げる。 */
const POUR_TILT_DEG = 62;
const LIFT_EASING = "ease-out";
const TRAVEL_EASING = "ease-in-out";
const TILT_EASING = "cubic-bezier(.22,.61,.36,1)";
/** 筋の太さ（瓶の幅に対する割合）。とろみがあるので水より太い。 */
const STREAM_WIDTH_RATIO = 0.26;

type KitchenPourSourceProps = {
  animation: PourAnimation;
  onFinish: (animationId: number) => void;
};

export function KitchenPourSource({
  animation,
  onFinish,
}: KitchenPourSourceProps) {
  const jarRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const streamCoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const jar = jarRef.current;
    if (!jar?.animate) {
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
      duration: KITCHEN_POUR_DURATION_MS,
      easing: "linear",
    };
    const extraAnimations: Animation[] = [];

    const cancel = playAnimations({
      animate() {
        const hover = `translate(${deltaX}px, ${hoverY}px)`;
        const jarAnimation = jar.animate(
          [
            {
              transform: `translate(0, ${liftY}px) rotate(0deg)`,
              offset: 0,
              easing: LIFT_EASING,
            },
            {
              transform: `translate(0, ${liftY - 4}px) rotate(0deg)`,
              offset: 0.06,
              easing: TILT_EASING,
            },
            {
              transform: `${hover} rotate(0deg)`,
              offset: 0.2,
              easing: TRAVEL_EASING,
            },
            {
              transform: `${hover} rotate(${direction * POUR_TILT_DEG}deg)`,
              offset: 0.33,
              easing: LIFT_EASING,
            },
            {
              transform: `${hover} rotate(${direction * POUR_TILT_DEG}deg)`,
              offset: 0.8,
              easing: TILT_EASING,
            },
            { transform: `${hover} rotate(0deg)`, offset: 0.88 },
            { transform: "translate(0, 0) rotate(0deg)", offset: 1 },
          ],
          timing,
        );
        // 太い筋が上から伸びて落ち、最後は細くなって切れ、尾が瓶の中へ落ちる。
        const stream = streamRef.current?.animate?.(
          [
            { clipPath: "inset(0 0 100% 0)", offset: 0 },
            { clipPath: "inset(0 0 100% 0)", offset: 0.33 },
            {
              clipPath: "inset(0 0 0% 0)",
              offset: KITCHEN_POUR_TRANSFER_START + 0.02,
            },
            {
              clipPath: "inset(0% 0 0 0)",
              offset: KITCHEN_POUR_TRANSFER_END - 0.06,
            },
            {
              clipPath: "inset(100% 0 0 0)",
              offset: KITCHEN_POUR_TRANSFER_END + 0.04,
            },
            { clipPath: "inset(100% 0 0 0)", offset: 1 },
          ],
          timing,
        );
        const core = streamCoreRef.current?.animate?.(
          [
            { transform: "scaleX(1)", offset: 0 },
            {
              transform: "scaleX(1)",
              offset: KITCHEN_POUR_TRANSFER_END - 0.14,
            },
            { transform: "scaleX(0.4)", offset: KITCHEN_POUR_TRANSFER_END },
            { transform: "scaleX(0.4)", offset: 1 },
          ],
          timing,
        );
        for (const extra of [stream, core]) {
          if (extra) {
            extraAnimations.push(extra);
          }
        }
        return [jarAnimation];
      },
      completion: { type: "after-animations", holdMs: 0 },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished() {
        onFinish(animation.id);
      },
    });

    return () => {
      cancel();
      for (const extra of extraAnimations) {
        extra.cancel();
      }
    };
  }, [onFinish, animation]);

  const { rect: sourceRect } = animation.source;
  const { rect: destinationRect, before } = animation.destination;
  const streamTop = destinationRect.top - sourceRect.height * 0.55 + 2;
  const streamBottom =
    destinationRect.top +
    destinationRect.height * getSyrupSurfaceRatio(before.length);
  const streamWidth = Math.max(6, destinationRect.width * STREAM_WIDTH_RATIO);

  return (
    <>
      <div
        ref={jarRef}
        aria-hidden="true"
        className="pointer-events-none fixed origin-top will-change-transform"
        style={getOverlayStyle(sourceRect, POUR_LAYER_ORDER.source)}
      >
        <KitchenJar
          contents={animation.source.after}
          role="pour-source"
          waterOverlay={
            <SyrupTransfer
              colorIndex={animation.colorIndex}
              startSlot={animation.source.after.length}
              slotCount={
                animation.source.before.length - animation.source.after.length
              }
              flow="drain"
            />
          }
        />
      </div>
      <div
        ref={streamRef}
        aria-hidden="true"
        className="pointer-events-none fixed"
        style={{
          left:
            destinationRect.left + destinationRect.width / 2 - streamWidth / 2,
          top: streamTop,
          width: streamWidth,
          height: streamBottom - streamTop,
          zIndex: POUR_LAYER_ORDER.stream,
          clipPath: "inset(0 0 100% 0)",
        }}
      >
        <div
          ref={streamCoreRef}
          className="size-full"
          style={{
            ...getSyrupStreamStyle(animation.colorIndex),
            // 口からは太く出て、落ちるにつれて細くなる。
            clipPath:
              "polygon(0% 0%, 100% 0%, 82% 22%, 72% 100%, 28% 100%, 18% 22%)",
          }}
        />
      </div>
    </>
  );
}
