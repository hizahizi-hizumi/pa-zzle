/** 直進区間とみなす最小のマス数。研究用 Python の `straight_ratio` の `run` と同じ値。 */
const STRAIGHT_RUN_CELL_COUNT = 4;

/**
 * 解の道の直進率。同じ向きに続けて進む区間のうち、4マス以上続くもの（直進区間）に含まれるマスの割合。
 * 蛇行するだけの単調な道ほど高い。研究用 Python の `straight_ratio` と同じ定義で、区間の両端のマスも含める。
 * 道は行優先のマス番号の並びで、隣り合うマスの番号の差が進む向きを表す。
 */
export function measureHitofudePuzzleStraightRatio(
  path: readonly number[],
): number {
  if (path.length < 3) {
    return 0;
  }
  const covered = new Uint8Array(path.length);
  let runStart = 0;
  for (let step = 1; step < path.length; step += 1) {
    const isLastStep = step === path.length - 1;
    const continuesRun =
      !isLastStep &&
      path[step + 1]! - path[step]! === path[runStart + 1]! - path[runStart]!;
    if (continuesRun) {
      continue;
    }
    // runStart から step までのマスが同じ向きに並ぶ区間。
    if (step - runStart + 1 >= STRAIGHT_RUN_CELL_COUNT) {
      covered.fill(1, runStart, step + 1);
    }
    runStart = step;
  }
  return covered.reduce((sum, value) => sum + value, 0) / path.length;
}
