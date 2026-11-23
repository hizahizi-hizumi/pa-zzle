import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { LiquidSurface } from "@/games/water-sort/ui/board/test-tube/LiquidSurface";
import { getLiquidRuns } from "@/games/water-sort/ui/board/test-tube/liquid-runs";
import { LIQUID_BOUNDARY } from "@/games/water-sort/ui/board/test-tube/liquid-surface";
import { getReagentColor } from "@/games/water-sort/ui/board/test-tube/reagent";

type LiquidProps = {
  contents: WaterSortBottle;
  /** 同じ試薬が上から注がれている間 `true`。いちばん上の液面を消し、注がれる液とひとつに見せる。 */
  receivingSameReagent?: boolean;
};

export function Liquid({
  contents,
  receivingSameReagent = false,
}: LiquidProps) {
  const runs = getLiquidRuns(contents);
  return runs.map((run, runIndex) => {
    const isTop = runIndex === runs.length - 1;
    return (
      <span
        key={`${run.startSlot}-${run.colorIndex}-${run.slotCount}`}
        className="absolute inset-x-0"
        style={{
          bottom: `${run.startSlot * 25}%`,
          // 段の境目に地が透けないよう、上の段へわずかに重ねる。
          height: `calc(${run.slotCount * 25}% + 0.5px)`,
          backgroundColor: getReagentColor(run.colorIndex),
        }}
      >
        {isTop && !receivingSameReagent && <LiquidSurface />}
        {!isTop && (
          <span
            className="absolute inset-x-0 top-0"
            style={{
              height: LIQUID_BOUNDARY.px,
              backgroundColor: LIQUID_BOUNDARY.color,
            }}
          />
        )}
      </span>
    );
  });
}
