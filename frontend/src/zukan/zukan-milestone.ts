/** 解いた問題の数の節目。全問の数より小さい節目と、全問の数そのものを節目にする。 */
const ZUKAN_MILESTONES = [
  10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
] as const;

/**
 * 解いた数から見た、ひとつ前の節目と次の節目。
 * - `previous`: 解いた数以下で最も大きい節目。まだ届いた節目が無ければ 0。
 * - `next`: 解いた数より大きい最も小さい節目。全問を解いていれば `null`。
 */
export type ZukanMilestoneProgress = {
  solvedCount: number;
  previous: number;
  next: number | null;
};

function listMilestones(problemCount: number): number[] {
  return [
    ...ZUKAN_MILESTONES.filter((milestone) => milestone < problemCount),
    problemCount,
  ];
}

export function findZukanMilestoneProgress(
  solvedCount: number,
  problemCount: number,
): ZukanMilestoneProgress {
  const milestones = listMilestones(problemCount);
  return {
    solvedCount,
    previous: milestones.findLast((milestone) => milestone <= solvedCount) ?? 0,
    next: milestones.find((milestone) => milestone > solvedCount) ?? null,
  };
}

export function isZukanMilestone(
  solvedCount: number,
  problemCount: number,
): boolean {
  return solvedCount > 0 && listMilestones(problemCount).includes(solvedCount);
}

/** `count` 以上で最も小さい節目。全問の数で切らない。最後の節目を越えたら、最後の節目の倍数へ切り上げる。 */
export function findZukanMilestoneAtLeast(count: number): number {
  const last = ZUKAN_MILESTONES[ZUKAN_MILESTONES.length - 1] ?? 1;
  return (
    ZUKAN_MILESTONES.find((milestone) => milestone >= count) ??
    Math.ceil(count / last) * last
  );
}

/** 次の節目までの進み（0〜1）。全問を解いていれば 1。 */
export function getZukanMilestoneRatio({
  solvedCount,
  previous,
  next,
}: ZukanMilestoneProgress): number {
  return next === null ? 1 : (solvedCount - previous) / (next - previous);
}
