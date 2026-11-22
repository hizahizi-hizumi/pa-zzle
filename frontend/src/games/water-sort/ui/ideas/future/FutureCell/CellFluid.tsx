import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  FIELD_BARRIER_BACKGROUND,
  getFluidRuns,
  getFluidSurfaceSheen,
  getFutureFluidFill,
} from "@/games/water-sort/ui/ideas/future/future-palette";

type CellFluidProps = {
  contents: WaterSortBottle;
  locked: boolean;
  /** 液面の上に別の液が重なって動いている間は、液面の照りを描かない。 */
  showsSurface: boolean;
};

/**
 * 同じ色の段はひとつの液にまとめ、違う色が接する所にだけ、場の隔て（暗い隙間に細い光の線）を引く。
 * 段の高さは、まとめても 1段 = 25% のまま。
 */
export function CellFluid({ contents, locked, showsSurface }: CellFluidProps) {
  const runs = getFluidRuns(contents);
  const topRun = runs[runs.length - 1];

  return (
    <>
      {runs.map((run) => (
        <span
          key={`${run.startSlot}-${run.colorIndex}-${run.slotCount}`}
          className="absolute inset-x-0 transition-[filter] duration-500"
          style={{
            bottom: `${run.startSlot * 25}%`,
            height: `${run.slotCount * 25}%`,
            background: getFutureFluidFill(run.colorIndex, locked ? 1 : 0),
            filter: locked ? "saturate(1.08)" : undefined,
          }}
        />
      ))}
      {runs.slice(1).map((run) => (
        <span
          key={`field-${run.startSlot}`}
          className="absolute inset-x-0 h-[3px] translate-y-1/2"
          style={{
            bottom: `${run.startSlot * 25}%`,
            background: FIELD_BARRIER_BACKGROUND,
          }}
        />
      ))}
      {showsSurface && topRun && (
        <span
          className="absolute inset-x-0 h-[3px]"
          style={{
            bottom: `calc(${(topRun.startSlot + topRun.slotCount) * 25}% - 3px)`,
            background: getFluidSurfaceSheen(topRun.colorIndex),
            opacity: 0.8,
          }}
        />
      )}
    </>
  );
}
