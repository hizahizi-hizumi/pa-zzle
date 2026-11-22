import type { Ref } from "react";

import { getLiquidStyle } from "@/games/water-sort/ui/ideas/bar/bar-liquids";

type TransferLiquidProps = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
  elementRef: Ref<HTMLSpanElement>;
  initialScaleY: number;
};

/** 注いでいる間に、注ぎ元で減り注ぎ先で増える層。 */
export function TransferLiquid({
  colorIndex,
  startSlot,
  slotCount,
  elementRef,
  initialScaleY,
}: TransferLiquidProps) {
  return (
    <span
      ref={elementRef}
      className="absolute inset-x-0 origin-bottom will-change-transform"
      style={{
        ...getLiquidStyle(colorIndex),
        bottom: `${startSlot * 25}%`,
        height: `calc(${slotCount * 25}% + 1px)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
        transform: `scaleY(${initialScaleY})`,
      }}
    />
  );
}
