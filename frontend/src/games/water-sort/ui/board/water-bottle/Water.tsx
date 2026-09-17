import type { WaterSortBottle } from "@/games/water-sort/game/state";

import { getWaterColorView } from "./get-water-color-view";

const bottleSlots = [0, 1, 2, 3] as const;

type WaterProps = {
  contents: WaterSortBottle;
};

export function Water({ contents }: WaterProps) {
  return bottleSlots.map((slotIndex) => {
    const colorIndex = contents[slotIndex];
    if (colorIndex === undefined) {
      return null;
    }

    return (
      <span
        key={`${slotIndex}-${colorIndex}-${contents.length}`}
        className="absolute inset-x-0 h-1/4 transition-[background-color] duration-200"
        style={{
          bottom: `${slotIndex * 25}%`,
          backgroundColor: getWaterColorView(colorIndex).color,
        }}
      />
    );
  });
}
