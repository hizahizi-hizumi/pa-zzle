import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { getLiquidRuns } from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";
import {
  getLiquidStyle,
  getLiquidSurfaceShadow,
} from "@/games/water-sort/ui/ideas/bar/bar-liquids";

type BarLiquidProps = {
  contents: WaterSortBottle;
};

export function BarLiquid({ contents }: BarLiquidProps) {
  const runs = getLiquidRuns(contents);

  return runs.map((run, runIndex) => {
    const isTop = runIndex === runs.length - 1;
    return (
      <span
        key={`${run.startSlot}-${run.colorIndex}-${run.slotCount}`}
        className="absolute inset-x-0"
        style={{
          ...getLiquidStyle(run.colorIndex),
          bottom: `${run.startSlot * 25}%`,
          // 下の層へ1px重ね、層の継ぎ目に地が透けないようにする。
          height: `calc(${run.slotCount * 25}% + 1px)`,
          boxShadow: isTop
            ? `${getLiquidSurfaceShadow(run.colorIndex)}, inset 0 3px 3px -2px rgba(255,255,255,0.35)`
            : getLiquidSurfaceShadow(run.colorIndex),
        }}
      />
    );
  });
}
