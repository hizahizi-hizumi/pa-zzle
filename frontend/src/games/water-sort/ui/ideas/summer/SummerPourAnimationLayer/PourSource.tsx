import { useEffect, useRef } from "react";

import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { getSummerBottleShape } from "@/games/water-sort/ui/ideas/summer/bottle-shapes";
import { SummerBottle } from "@/games/water-sort/ui/ideas/summer/SummerBottle";
import {
  droplets,
  getDropletKeyframes,
  getPourMouthY,
  getSourceKeyframes,
  getSurfaceRise,
  getSurfaceY,
  streamKeyframes,
} from "@/games/water-sort/ui/ideas/summer/SummerPourAnimationLayer/pour-gesture";
import { TransferLiquid } from "@/games/water-sort/ui/ideas/summer/SummerPourAnimationLayer/TransferLiquid";
import { SUMMER_POUR_DURATION_MS } from "@/games/water-sort/ui/ideas/summer/summer-motion";
import { getSummerWaterColor } from "@/games/water-sort/ui/ideas/summer/summer-palette";
import { playAnimations } from "@/lib/motion";

type PourSourceProps = {
  animation: PourAnimation;
  onFinish: (animationId: number) => void;
};

/** 注ぐ演出の層の重なり順（プレイ画面の中）。注ぎ先・流れ・注ぎ元の順に重ねる。 */
const LAYER = { stream: 2, source: 3 } as const;

export function PourSource({ animation, onFinish }: PourSourceProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const dropletRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const { rect: sourceRect } = animation.source;
  const { rect: destinationRect, before } = animation.destination;
  const color = getSummerWaterColor(animation.colorIndex);
  const mouthY = getPourMouthY(animation);
  const surfaceY = getSurfaceY(destinationRect, before.length);
  const streamWidth = Math.max(3, destinationRect.width * 0.14);
  const dropletSize = Math.max(3, destinationRect.width * 0.1);
  const centerX = destinationRect.left + destinationRect.width / 2;

  useEffect(() => {
    const sourceElement = sourceRef.current;
    if (!sourceElement?.animate) {
      onFinish(animation.id);
      return;
    }
    const timing = { duration: SUMMER_POUR_DURATION_MS, easing: "linear" };
    let sideAnimations: Animation[] = [];

    const cancel = playAnimations({
      animate() {
        const source = sourceElement.animate(
          getSourceKeyframes(animation),
          timing,
        );
        const stream = streamRef.current?.animate?.(streamKeyframes, timing);
        const splashes = droplets.flatMap((droplet, index) => {
          const element = dropletRefs.current[index];
          const played = element?.animate?.(
            getDropletKeyframes(
              droplet,
              destinationRect.width,
              getSurfaceRise(animation, droplet.start),
            ),
            timing,
          );
          return played ? [played] : [];
        });
        sideAnimations = [...(stream ? [stream] : []), ...splashes];
        return [source];
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
      for (const side of sideAnimations) {
        side.cancel();
      }
    };
  }, [animation, destinationRect.width, onFinish]);

  return (
    <>
      <div
        ref={sourceRef}
        aria-hidden="true"
        className="pointer-events-none fixed origin-top will-change-transform"
        style={{
          left: sourceRect.left,
          top: sourceRect.top,
          width: sourceRect.width,
          height: sourceRect.height,
          zIndex: LAYER.source,
        }}
      >
        <SummerBottle
          contents={animation.source.after}
          shape={getSummerBottleShape(animation.source.bottleIndex)}
          role="pour-source"
          continuingColorIndex={animation.colorIndex}
          overlay={
            <TransferLiquid
              colorIndex={animation.colorIndex}
              startSlot={animation.source.after.length}
              slotCount={
                animation.source.before.length - animation.source.after.length
              }
              direction="drain"
            />
          }
        />
      </div>
      <div
        ref={streamRef}
        aria-hidden="true"
        className="pointer-events-none fixed origin-top rounded-full opacity-0 will-change-transform"
        style={{
          left: centerX - streamWidth / 2,
          top: mouthY,
          width: streamWidth,
          height: Math.max(surfaceY - mouthY, 0),
          zIndex: LAYER.stream,
          background: `linear-gradient(90deg, ${color.light} 0%, ${color.water} 45%, ${color.water} 100%)`,
        }}
      />
      {droplets.map((droplet, index) => (
        <span
          key={droplet.start}
          ref={(element) => {
            dropletRefs.current[index] = element;
          }}
          aria-hidden="true"
          className="pointer-events-none fixed rounded-full opacity-0"
          style={{
            left: centerX - dropletSize / 2,
            top: surfaceY - dropletSize / 2,
            width: dropletSize,
            height: dropletSize,
            zIndex: LAYER.stream,
            background: `radial-gradient(circle at 35% 30%, #ffffff 0 18%, ${color.water} 45%)`,
          }}
        />
      ))}
    </>
  );
}
