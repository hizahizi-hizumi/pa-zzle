function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 満点に対する達成比率を整数の点へ変換する。比率は 0 から 1 の範囲に収める。 */
export function calculateLinearScore(maximum: number, ratio: number): number {
  return Math.round(maximum * clampUnit(ratio));
}

/** 満点から減点を引いた点。0点を下回らない。 */
export function subtractWithFloor(maximum: number, penalty: number): number {
  return Math.max(0, maximum - penalty);
}
