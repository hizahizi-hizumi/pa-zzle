import { useEffect, useRef } from "react";
import { isCompleteWaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { TransferLiquid } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/TransferLiquid";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_STOPPER_SEATED_OFFSET,
  POUR_STOPPER_START_OFFSET,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { TestTube } from "@/games/water-sort/ui/board/test-tube/TestTube";

type PourDestinationProps = {
  animation: PourAnimation;
};

/** 注ぎ先。液が口から流れ込んで液面が上がり、1種類で満ちたらゴム栓をきゅっと差し込む。 */
export function PourDestination({ animation }: PourDestinationProps) {
  const transferRef = useRef<HTMLSpanElement>(null);
  const stopperRef = useRef<SVGSVGElement>(null);
  const { before, after } = animation.destination;
  const slotCount = after.length - before.length;
  const sealed = isCompleteWaterSortBottle(after);

  useEffect(() => {
    const transferAnimation = transferRef.current?.animate?.(
      [
        { height: "0%", offset: 0 },
        { height: "0%", offset: POUR_TRANSFER_START_OFFSET },
        { height: `${slotCount * 25}%`, offset: POUR_TRANSFER_END_OFFSET },
        { height: `${slotCount * 25}%`, offset: 1 },
      ],
      { duration: POUR_ANIMATION_DURATION_MS, fill: "forwards" },
    );
    const pressIn = POUR_STOPPER_SEATED_OFFSET - 0.025;
    const stopperAnimation = stopperRef.current?.animate?.(
      [
        { transform: "translateY(-16%) rotate(-6deg)", opacity: 0, offset: 0 },
        {
          transform: "translateY(-16%) rotate(-6deg)",
          opacity: 0,
          offset: POUR_STOPPER_START_OFFSET,
          easing: "cubic-bezier(.3,0,.6,1)",
        },
        {
          transform: "translateY(-5%) rotate(-2deg)",
          opacity: 1,
          offset: pressIn,
          easing: "cubic-bezier(.5,0,.8,.6)",
        },
        {
          transform: "translateY(0.6%) scale(1.06, 0.9)",
          opacity: 1,
          offset: POUR_STOPPER_SEATED_OFFSET,
          easing: "ease-out",
        },
        { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.92 },
        { transform: "translateY(0) scale(1)", opacity: 1, offset: 1 },
      ],
      { duration: POUR_ANIMATION_DURATION_MS, fill: "both" },
    );
    return () => {
      transferAnimation?.cancel();
      stopperAnimation?.cancel();
    };
  }, [slotCount]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed"
      style={getOverlayStyle(
        animation.destination.rect,
        POUR_LAYER_ORDER.destination,
      )}
    >
      <TestTube
        contents={before}
        stoppered={sealed}
        stopperRef={stopperRef}
        receivingSameReagent={
          before[before.length - 1] === animation.colorIndex
        }
        liquidOverlay={
          <TransferLiquid
            colorIndex={animation.colorIndex}
            startSlot={before.length}
            slotCount={slotCount}
            elementRef={transferRef}
            initiallyFull={false}
          />
        }
      />
    </div>
  );
}
