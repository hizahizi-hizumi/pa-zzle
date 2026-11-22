import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  FLAT_SURFACE_SHADE,
  getFlatReagentFill,
} from "@/games/water-sort/ui/art/flat/flat-reagent";
import { getLiquidRuns } from "@/games/water-sort/ui/board/test-tube/liquid-runs";

type FlatLiquidProps = {
  contents: WaterSortBottle;
  /** 同じ試薬が上から注がれている間 `true`。いちばん上の液面の帯を消し、注がれる液とひとつに見せる。 */
  receivingSameReagent?: boolean;
};

export function FlatLiquid({
  contents,
  receivingSameReagent = false,
}: FlatLiquidProps) {
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
          ...getFlatReagentFill(run.colorIndex),
        }}
      >
        {isTop && !receivingSameReagent && (
          // 傾けた液の液面（注ぐ演出が描く）と同じ、縁の暗い帯とその下の白い帯にする。
          <span
            className="absolute inset-x-0 top-0 h-[2.6px]"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(20,30,35,${FLAT_SURFACE_SHADE}) 0 1px, rgba(255,255,255,0.5) 1px 2.6px)`,
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
