/** 滑りは距離に比例する時間で、等速で動かす。 */
const SLIDE_BASE_MS = 45;
const SLIDE_PER_CELL_MS = 32;
/** 上限は12×14の盤面の最も長い滑り（13マス）が収まる長さに近く、それより長い滑りでもこれを超えない。 */
const SLIDE_MAX_MS = 400;

export function getIceFloorMazeSlideDurationMs(distance: number): number {
  return Math.min(SLIDE_MAX_MS, SLIDE_BASE_MS + SLIDE_PER_CELL_MS * distance);
}

/** 滑り始めてから、駒が出発マスから `cells` マス進んだ位置に着くまでの時間。 */
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

/** 滑りで雪を押し出し始める時刻。駒が雪のマスに入り始める、最後の1マスを進み始めた時刻とする。 */
export function getIceFloorMazeSnowPushDelayMs({
  path,
}: {
  path: readonly number[];
}): number {
  return getIceFloorMazeSlideProgressMs(path.length, path.length - 1);
}

/**
 * 滑りで押した滑る氷の塊に駒が触れる時刻。駒は塊の元のマス `blockFrom` の手前まで進んだところで触れ、
 * そこから塊と同じ速さで一緒に進む。`path` の `i` 番目は `i + 1` マス目なので、塊の元のマスの番号がそのまま触れるまでのマス数。
 */
export function getIceFloorMazeBlockContactMs(
  { path }: { path: readonly number[] },
  blockFrom: number,
): number {
  return getIceFloorMazeSlideProgressMs(path.length, path.indexOf(blockFrom));
}
