import { useEffect, useRef } from "react";

import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { TransferLiquid } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/TransferLiquid";
import {
  BAR_POUR_DURATION_MS,
  BAR_POUR_EASING,
  BAR_POUR_PHASE,
} from "@/games/water-sort/ui/ideas/bar/bar-pour-timeline";

type DestinationTransferProps = {
  animation: PourAnimation;
};

/** スプーンの皿から液面に広がり、層として静かに積もる液。 */
export function DestinationTransfer({ animation }: DestinationTransferProps) {
  const transferRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const transferAnimation = transferRef.current?.animate?.(
      [
        { transform: "scaleY(0)", offset: 0 },
        { transform: "scaleY(0)", offset: BAR_POUR_PHASE.transferStart },
        { transform: "scaleY(1)", offset: BAR_POUR_PHASE.transferEnd },
        { transform: "scaleY(1)", offset: 1 },
      ],
      {
        duration: BAR_POUR_DURATION_MS,
        easing: BAR_POUR_EASING.linear,
        fill: "forwards",
      },
    );
    return () => transferAnimation?.cancel();
  }, []);

  return (
    <TransferLiquid
      colorIndex={animation.colorIndex}
      startSlot={animation.destination.before.length}
      slotCount={
        animation.destination.after.length - animation.destination.before.length
      }
      elementRef={transferRef}
      initialScaleY={0}
    />
  );
}
