import { useLayoutEffect, useRef } from "react";

import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import {
  getTransferFluidHeight,
  TransferFluid,
} from "@/games/water-sort/ui/ideas/future/FuturePourLayer/TransferFluid";
import {
  getFieldPourElapsed,
  getFieldPourFrame,
} from "@/games/water-sort/ui/ideas/future/future-pour-timing";

type ReceivedFluidProps = {
  animation: PourAnimation;
  slotCount: number;
};

export function ReceivedFluid({ animation, slotCount }: ReceivedFluidProps) {
  const fluidRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    let frameRequest = 0;
    function render() {
      const t = getFieldPourElapsed(animation);
      if (fluidRef.current) {
        fluidRef.current.style.height = getTransferFluidHeight(
          slotCount,
          getFieldPourFrame(t).received,
        );
      }
      if (t < 1) {
        frameRequest = requestAnimationFrame(render);
      }
    }
    render();
    return () => cancelAnimationFrame(frameRequest);
  }, [animation, slotCount]);

  return (
    <TransferFluid
      colorIndex={animation.colorIndex}
      startSlot={animation.destination.before.length}
      slotCount={slotCount}
      separated={false}
      elementRef={fluidRef}
      initialFill={0}
    />
  );
}
