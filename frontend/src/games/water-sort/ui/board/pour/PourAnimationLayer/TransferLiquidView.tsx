import type { RefObject } from "react";

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
};

export function TransferLiquidView({ transfer }: TransferLiquidViewProps) {
  return (
    <span
      ref={transfer.elementRef}
      className="absolute inset-x-0 origin-bottom will-change-transform"
      style={{
        bottom: `${transfer.startSlot * 25}%`,
        height: `${transfer.slotCount * 25}%`,
        backgroundColor: getWaterColorView(transfer.colorIndex).color,
        transform: `scaleY(${transfer.initialScaleY})`,
      }}
    />
  );
}
