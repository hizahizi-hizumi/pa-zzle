import type { CSSProperties } from "react";
import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

const bottleSlots = [0, 1, 2, 3] as const;

type WaterProps = {
  contents: WaterSortBottle;
  appearance?: WaterSortAppearance;
};

export function Water({ contents, appearance = "classic" }: WaterProps) {
  return bottleSlots.map((slotIndex) => {
    const colorIndex = contents[slotIndex];
    if (colorIndex === undefined) {
      return null;
    }

    return (
      <span
        key={`${slotIndex}-${colorIndex}-${contents.length}`}
        className="water-sort-liquid absolute inset-x-0 h-[calc(25%+1px)] transition-[background-color] duration-(--duration-slow)"
        style={
          {
            bottom: `${slotIndex * 25}%`,
            backgroundColor: getWaterColorView(colorIndex).color,
            "--water-color": getWaterColorView(colorIndex).color,
          } as CSSProperties
        }
      />
    );
  });
}
