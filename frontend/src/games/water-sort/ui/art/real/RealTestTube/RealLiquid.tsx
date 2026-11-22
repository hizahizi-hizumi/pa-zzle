import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  getRealReagentFill,
  getRealReagentLook,
  getRealReagentSurfaceShade,
} from "@/games/water-sort/ui/art/real/real-reagent";
import { getLiquidRuns } from "@/games/water-sort/ui/board/test-tube/liquid-runs";

type RealLiquidProps = {
  contents: WaterSortBottle;
  /** 同じ試薬が上から注がれている間 `true`。いちばん上の液面を消し、注がれる液とひとつに見せる。 */
  receivingSameReagent?: boolean;
};

function getMeniscusImage(shade: number): string {
  return `linear-gradient(180deg, rgba(20,30,35,${shade}) 0, rgba(20,30,35,${shade}) 1px, rgba(255,255,255,0.6) 1px, rgba(255,255,255,0.15) 2.5px, transparent 4px)`;
}

/**
 * 立てた試験管の中の液。液面は、ガラスに接して暗いメニスカスと、その下で窓を映して明るむ面。
 * 層の境目は、上の液を透して見る細い明るい面。底の丸いガラスで集まった光が、底の右に抜ける。
 */
export function RealLiquid({
  contents,
  receivingSameReagent = false,
}: RealLiquidProps) {
  const runs = getLiquidRuns(contents);
  const bottom = runs[0];
  const focusesLight =
    bottom !== undefined && getRealReagentLook(bottom.colorIndex) !== "deep";
  return (
    <>
      {runs.map((run, runIndex) => {
        const isTop = runIndex === runs.length - 1;
        return (
          <span
            key={`${run.startSlot}-${run.colorIndex}-${run.slotCount}`}
            className="absolute inset-x-0"
            style={{
              bottom: `${run.startSlot * 25}%`,
              // 段の境目に地が透けないよう、上の段へわずかに重ねる。
              height: `calc(${run.slotCount * 25}% + 0.5px)`,
              ...getRealReagentFill(run.colorIndex),
            }}
          >
            {isTop && !receivingSameReagent && (
              <span
                className="absolute inset-x-0 top-0 h-[4px]"
                style={{
                  backgroundImage: getMeniscusImage(
                    getRealReagentSurfaceShade(run.colorIndex),
                  ),
                }}
              />
            )}
            {!isTop && (
              <span className="absolute inset-x-0 top-0 h-px bg-white/40" />
            )}
          </span>
        );
      })}
      {focusesLight && (
        <span
          className="absolute inset-x-0 bottom-0 h-[16%]"
          style={{
            backgroundImage:
              "radial-gradient(40% 55% at 64% 92%, rgba(255,255,255,0.42), rgba(255,255,255,0) 100%)",
          }}
        />
      )}
    </>
  );
}
