/** パスの文字列を短く保つため、座標を丸める。 */
export function roundIceFloorMazeCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}
