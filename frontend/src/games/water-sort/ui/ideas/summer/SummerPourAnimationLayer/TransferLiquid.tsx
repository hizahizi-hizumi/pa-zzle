import { useEffect, useRef } from "react";

import {
  SUMMER_POUR_DURATION_MS,
  SUMMER_POUR_TRANSFER_END,
  SUMMER_POUR_TRANSFER_START,
} from "@/games/water-sort/ui/ideas/summer/summer-motion";
import { getLiquidStyle } from "@/games/water-sort/ui/ideas/summer/summer-palette";

type TransferLiquidProps = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
  /**
   * - `drain`: 注ぎ元から減っていく。
   * - `fill`: 注ぎ先に増えていく。
   */
  direction: "drain" | "fill";
};

const BOTTLE_CAPACITY = 4;

export function TransferLiquid({
  colorIndex,
  startSlot,
  slotCount,
  direction,
}: TransferLiquidProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [from, to] = direction === "drain" ? [1, 0] : [0, 1];

  useEffect(() => {
    const animation = ref.current?.animate?.(
      [
        { transform: `scaleY(${from})`, offset: 0 },
        { transform: `scaleY(${from})`, offset: SUMMER_POUR_TRANSFER_START },
        { transform: `scaleY(${to})`, offset: SUMMER_POUR_TRANSFER_END },
        { transform: `scaleY(${to})`, offset: 1 },
      ],
      {
        duration: SUMMER_POUR_DURATION_MS,
        easing: "linear",
        fill: "forwards",
      },
    );
    return () => animation?.cancel();
  }, [from, to]);

  return (
    <span
      ref={ref}
      className="absolute inset-x-0 origin-bottom will-change-transform"
      style={{
        bottom: `${(startSlot / BOTTLE_CAPACITY) * 100}%`,
        height: `${(slotCount / BOTTLE_CAPACITY) * 100}%`,
        transform: `scaleY(${from})`,
        ...getLiquidStyle(colorIndex, "surface"),
      }}
    />
  );
}
