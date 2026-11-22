import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { getReagentFill } from "@/games/water-sort/ui/ideas/lab/lab-reagents";

type LabLiquidProps = {
  contents: WaterSortBottle;
  /** 同じ試薬が上から注がれている間 `true`。いちばん上の液面の線を消し、注がれる液とひとつに見せる。 */
  receivingSameReagent?: boolean;
};

type LiquidRun = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
};

/** 同じ試薬が続く段は、ひとつの液として境目を描かない。 */
function getLiquidRuns(contents: WaterSortBottle): LiquidRun[] {
  const runs: LiquidRun[] = [];
  contents.forEach((colorIndex, slotIndex) => {
    const last = runs[runs.length - 1];
    if (last && last.colorIndex === colorIndex) {
      last.slotCount += 1;
      return;
    }
    runs.push({ colorIndex, startSlot: slotIndex, slotCount: 1 });
  });
  return runs;
}

export function LabLiquid({
  contents,
  receivingSameReagent = false,
}: LabLiquidProps) {
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
        {!(isTop && receivingSameReagent) && (
          <span
            className={
              isTop
                ? "absolute inset-x-0 top-0 h-[3px] bg-linear-to-b from-white/60 via-white/15 to-transparent"
                : "absolute inset-x-0 top-0 h-px bg-white/45"
            }
          />
        )}
      </span>
    );
  });
}
