import type { ReactNode } from "react";

import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

import { Bottle } from "@/games/water-sort/ui/board/water-bottle/Bottle";
import { Water } from "@/games/water-sort/ui/board/water-bottle/Water";

type WaterBottleProps = {
  contents: WaterSortBottle;
  selected?: boolean;
  waterOverlay?: ReactNode;
  variant?: "default" | "fluid";
};

export function WaterBottle({
  contents,
  selected = false,
  waterOverlay,
  variant = "default",
}: WaterBottleProps) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0"
      data-variant={variant}
    >
      <span className="absolute inset-x-[4px] bottom-[4px] top-3 overflow-hidden rounded-b-[1.15rem] bg-black/[0.015]">
        <Water contents={contents} variant={variant} />
        {waterOverlay}
      </span>
      <Bottle selected={selected} variant={variant} />
    </span>
  );
}
