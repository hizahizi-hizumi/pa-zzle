import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { getLiquidRuns } from "@/games/water-sort/ui/board/test-tube/liquid-runs";
import {
  getReagentFill,
  getReagentSurfaceShade,
} from "@/games/water-sort/ui/board/test-tube/reagent";

type LiquidProps = {
  contents: WaterSortBottle;
  /** 同じ試薬が上から注がれている間 `true`。いちばん上の液面の線を消し、注がれる液とひとつに見せる。 */
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
          ...getReagentFill(run.colorIndex),
        }}
      >
        {isTop && !receivingSameReagent && (
          // 液面のメニスカス。縁の暗い線が、空の管の明るさと液の明るさを分ける。
          <span
            className="absolute inset-x-0 top-0 h-[4px]"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(20,30,35,${getReagentSurfaceShade(run.colorIndex)}) 0, rgba(20,30,35,${getReagentSurfaceShade(run.colorIndex)}) 1px, rgba(255,255,255,0.6) 1px, rgba(255,255,255,0.15) 2.5px, transparent 4px)`,
            }}
          />
        )}
        {!isTop && (
          <span className="absolute inset-x-0 top-0 h-px bg-white/45" />
        )}
      </span>
    );
  });
}
