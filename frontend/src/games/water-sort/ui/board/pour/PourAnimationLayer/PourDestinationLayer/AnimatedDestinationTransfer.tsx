import { useEffect, useRef } from "react";

import {
  POUR_ANIMATION_DURATION_MS,
  POUR_TRANSFER_END_OFFSET,
  POUR_TRANSFER_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { TransferLiquidView } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/TransferLiquidView";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";

type AnimatedDestinationTransferProps = {
  animation: PourAnimation;
};

export function AnimatedDestinationTransfer({
  animation,
}: AnimatedDestinationTransferProps) {
  const transferRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const transferAnimation = transferRef.current?.animate?.(
      [
        { transform: "scaleY(0)", offset: 0 },
        { transform: "scaleY(0)", offset: POUR_TRANSFER_START_OFFSET },
        { transform: "scaleY(1)", offset: POUR_TRANSFER_END_OFFSET },
        { transform: "scaleY(1)", offset: 1 },
      ],
      {
        duration: POUR_ANIMATION_DURATION_MS,
        easing: "linear",
        fill: "forwards",
      },
    );

    return () => transferAnimation?.cancel();
  }, []);

  return (
    <TransferLiquidView
      transfer={{
        colorIndex: animation.colorIndex,
        startSlot: animation.destination.before.length,
        slotCount:
          animation.destination.after.length -
          animation.destination.before.length,
        elementRef: transferRef,
        initialScaleY: 0,
      }}
    />
  );
}
