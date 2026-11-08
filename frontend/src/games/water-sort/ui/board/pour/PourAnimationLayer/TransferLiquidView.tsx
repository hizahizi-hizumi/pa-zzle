import type { CSSProperties, RefObject } from "react";

import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

type TransferLiquid = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
  elementRef: RefObject<HTMLSpanElement | null>;
  initialScaleY: number;
};

type TransferLiquidViewProps = {
  transfer: TransferLiquid;
  appearance: WaterSortAppearance;
};

export function TransferLiquidView({
  transfer,
  appearance,
}: TransferLiquidViewProps) {
  return (
    <span
      ref={transfer.elementRef}
      className="water-sort-liquid absolute inset-x-0 origin-bottom will-change-transform"
      data-appearance={appearance}
      style={
        {
          bottom: `${transfer.startSlot * 25}%`,
          height: `${transfer.slotCount * 25}%`,
          backgroundColor: getWaterColorView(transfer.colorIndex).color,
          "--water-color": getWaterColorView(transfer.colorIndex).color,
          transform: `scaleY(${transfer.initialScaleY})`,
        } as CSSProperties
      }
    />
  );
}
