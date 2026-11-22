import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  BAR_GLASS,
  BAR_GLASS_SLOT,
} from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";
import { getBarLiquid } from "@/games/water-sort/ui/ideas/bar/bar-liquids";

type GlassReflectionProps = {
  contents: WaterSortBottle;
  left: number;
  top: number;
  width: number;
  height: number;
  maxLength: number;
};

/** 映り込みの長さ（グラスの高さに対する割合）。 */
const REFLECTION_LENGTH = 0.42;

/** 磨いた天板に映る、グラスの底と液の色。足もとの影も置く。 */
export function GlassReflection({
  contents,
  left,
  top,
  width,
  height,
  maxLength,
}: GlassReflectionProps) {
  const baseLength = (1 - BAR_GLASS.baseTop) * height;
  const slotLength = BAR_GLASS_SLOT * height;
  const stops = [
    "rgba(255,238,215,0.5) 0px",
    `rgba(255,238,215,0.18) ${baseLength}px`,
    ...contents.flatMap((colorIndex, slot) => {
      const { color } = getBarLiquid(colorIndex);
      const start = baseLength + slot * slotLength;
      return [`${color} ${start}px`, `${color} ${start + slotLength}px`];
    }),
    `transparent ${baseLength + contents.length * slotLength}px`,
  ];

  return (
    <>
      <span
        className="absolute rounded-b-[30%] opacity-35 blur-[1.2px]"
        style={{
          left: left + width * BAR_GLASS.wallInset * 0.5,
          top: top + 1,
          width: width * (1 - BAR_GLASS.wallInset),
          height: Math.min(height * REFLECTION_LENGTH, maxLength),
          backgroundImage: `linear-gradient(180deg, ${stops.join(", ")})`,
          maskImage: "linear-gradient(180deg, black, transparent)",
        }}
      />
      <span
        className="absolute rounded-[50%] bg-[radial-gradient(closest-side,rgba(0,0,0,0.6),transparent)]"
        style={{
          left: left - width * 0.08,
          top: top - Math.max(3, height * 0.02),
          width: width * 1.16,
          height: Math.max(6, height * 0.04),
        }}
      />
    </>
  );
}
