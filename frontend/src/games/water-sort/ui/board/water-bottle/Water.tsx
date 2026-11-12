import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";

import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

const bottleSlots = [0, 1, 2, 3] as const;

type WaterProps = {
  contents: WaterSortBottle;
  variant?: "default" | "fluid";
};

export function Water({ contents, variant = "default" }: WaterProps) {
  if (variant === "fluid") {
    const runs: Array<{ color: number; start: number; units: number }> = [];
    for (const [slot, color] of contents.entries()) {
      const previous = runs.at(-1);
      if (previous?.color === color) {
        previous.units += 1;
      } else {
        runs.push({ color, start: slot, units: 1 });
      }
    }
    return runs.map(({ color, start, units }, index) => (
      <span
        key={`${start}-${color}`}
        className="water-sort-liquid-run absolute inset-x-0"
        data-surface={index === runs.length - 1}
        style={{
          bottom: `${start * 25}%`,
          height: `calc(${units * 25}% + 1px)`,
          backgroundColor: getWaterColorView(color).color,
        }}
      />
    ));
  }

  return bottleSlots.map((slotIndex) => {
    const colorIndex = contents[slotIndex];
    if (colorIndex === undefined) {
      return null;
    }

    return (
      <span
        key={`${slotIndex}-${colorIndex}-${contents.length}`}
        data-surface={slotIndex === contents.length - 1}
        className="water-sort-liquid-slot absolute inset-x-0 h-[calc(25%+1px)] transition-[background-color] duration-(--duration-slow)"
        style={{
          bottom: `${slotIndex * 25}%`,
          backgroundColor: getWaterColorView(colorIndex).color,
        }}
      />
    );
  });
}
