import { useEffect, useRef } from "react";

import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { LabTransferLiquid } from "@/games/water-sort/ui/ideas/lab/LabPourAnimationLayer/LabTransferLiquid";
import { LabTestTube } from "@/games/water-sort/ui/ideas/lab/LabTestTube";
import {
  LAB_STOPPER_SEATED_OFFSET,
  LAB_STOPPER_START_OFFSET,
} from "@/games/water-sort/ui/ideas/lab/lab-pour-timing";
import { isSealedTube } from "@/games/water-sort/ui/ideas/lab/lab-tube-state";

type LabPourDestinationProps = {
  animation: PourAnimation;
};

/** 注ぎ先。液が口から流れ込んで液面が上がり、1種類で満ちたらゴム栓をきゅっと差し込む。 */
export function LabPourDestination({ animation }: LabPourDestinationProps) {
  const transferRef = useRef<HTMLSpanElement>(null);
  const stopperRef = useRef<SVGSVGElement>(null);
  const { before, after } = animation.destination;
  const slotCount = after.length - before.length;
  const sealed = isSealedTube(after);

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
    const pressIn = LAB_STOPPER_SEATED_OFFSET - 0.025;
    const stopperAnimation = stopperRef.current?.animate?.(
      [
        { transform: "translateY(-16%) rotate(-6deg)", opacity: 0, offset: 0 },
        {
          transform: "translateY(-16%) rotate(-6deg)",
          opacity: 0,
          offset: LAB_STOPPER_START_OFFSET,
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
          offset: LAB_STOPPER_SEATED_OFFSET,
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
      <LabTestTube
        contents={before}
        stoppered={sealed}
        stopperRef={stopperRef}
        receivingSameReagent={
          before[before.length - 1] === animation.colorIndex
        }
        liquidOverlay={
          <LabTransferLiquid
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
