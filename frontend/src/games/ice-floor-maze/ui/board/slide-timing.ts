/**
 * 滑りは距離に比例する時間で、等速で動かす。長い滑りでも途中のマスが描かれ、ゴールの通過が動きから読める。
 * 上限は12×14の盤面の最も長い滑り（13マス）が収まる長さに近く、それより長い滑りでもこれを超えない。
 */
const SLIDE_BASE_MS = 45;
const SLIDE_PER_CELL_MS = 32;
const SLIDE_MAX_MS = 400;

export function getIceFloorMazeSlideDurationMs(distance: number): number {
  return Math.min(SLIDE_MAX_MS, SLIDE_BASE_MS + SLIDE_PER_CELL_MS * distance);
}

/** 滑り始めてから、駒が出発マスから `cells` マス進んだ位置に着くまでの時間。滑りは等速なので距離に比例する。 */
export function getIceFloorMazeSlideProgressMs(
  distance: number,
  cells: number,
): number {
  return (getIceFloorMazeSlideDurationMs(distance) * cells) / distance;
}

/**
 * 滑りで割れる薄い氷が割れ始める時刻。駒がそのマスを離れて半マス進んだ時刻とする。
 * 出発マスは 0 マス目、`path` の `i` 番目は `i + 1` マス目。
 */
export function getIceFloorMazeCrackDelayMs(
  { from, path }: { from: number; path: readonly number[] },
  cellIndex: number,
): number {
  const cellsFromStart = cellIndex === from ? 0 : path.indexOf(cellIndex) + 1;
  return getIceFloorMazeSlideProgressMs(path.length, cellsFromStart + 0.5);
}
