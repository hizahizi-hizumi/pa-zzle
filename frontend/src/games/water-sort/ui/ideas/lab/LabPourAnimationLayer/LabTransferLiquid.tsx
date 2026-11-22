import type { RefObject } from "react";

import { getReagentFill } from "@/games/water-sort/ui/ideas/lab/lab-reagents";

type LabTransferLiquidProps = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
  elementRef: RefObject<HTMLSpanElement | null>;
  /** 注ぎ元は満ちた所から減らし、注ぎ先は空の所から満たす。 */
  initiallyFull: boolean;
};

/** 試験管のあいだを移っている途中の液。高さを変えて、液面の線ごと上下させる。 */
export function LabTransferLiquid({
  colorIndex,
  startSlot,
  slotCount,
  elementRef,
  initiallyFull,
}: LabTransferLiquidProps) {
  return (
    <span
      ref={elementRef}
      className="absolute inset-x-0 overflow-hidden"
      style={{
        bottom: `${startSlot * 25}%`,
        height: initiallyFull ? `${slotCount * 25}%` : "0%",
        ...getReagentFill(colorIndex),
      }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-b from-white/60 via-white/15 to-transparent" />
    </span>
  );
}
