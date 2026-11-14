import type { ZukanProblemStatus } from "@/features/zukan/zukan-collection";

/**
 * 状態ごとの SVG パス。マスの1辺を 1 とし、同じ行で続くマスは1つの矩形にまとめる。
 * その状態のマスが無ければ、その状態を持たない。
 */
export function listZukanLevelMosaicPaths(
  statuses: readonly ZukanProblemStatus[],
  columnCount: number,
): ReadonlyMap<ZukanProblemStatus, string> {
  const paths = new Map<ZukanProblemStatus, string>();
  let runStart = 0;
  for (let index = 1; index <= statuses.length; index += 1) {
    const status = statuses[runStart];
    const continuesRun =
      index < statuses.length &&
      statuses[index] === status &&
      index % columnCount !== 0;
    if (status === undefined || continuesRun) {
      continue;
    }
    const row = Math.floor(runStart / columnCount);
    const column = runStart % columnCount;
    paths.set(
      status,
      `${paths.get(status) ?? ""}M${column},${row}h${index - runStart}v1h${runStart - index}z`,
    );
    runStart = index;
  }
  return paths;
}
