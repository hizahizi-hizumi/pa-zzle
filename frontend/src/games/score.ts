/** 評価項目。同じ意味の項目はゲームが違っても同じ名前にする。 */
export type ScoreItem = "accuracy" | "efficiency" | "speed" | "stability";

/** 評価項目ごとの満点。並び順は結果画面に出す順で、合計は100点。 */
export type ScoreMaximums<Item extends ScoreItem> = Readonly<
  Record<Item, number>
>;

/** 完了したプレイの評価点。合計と、評価項目ごとの点を持つ。 */
export type PlayScore<Item extends ScoreItem> = {
  total: number;
  breakdown: Record<Item, number>;
};

/**
 * 速さの採点規則。基準時間以内で満点、0点になる時間以上で0点とし、その間は超過時間に比例して減らす。
 * `overtimeStepMs` があれば、超過時間をその幅で切り上げてから減らす。
 */
export type SpeedScoreRule = {
  fullScoreMs: number;
  zeroScoreMs: number;
  overtimeStepMs?: number;
};

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

/** 評価項目ごとの点を合計した評価点。 */
export function sumPlayScore<Item extends ScoreItem>(
  breakdown: Record<Item, number>,
): PlayScore<Item> {
  const points: number[] = Object.values(breakdown);
  return {
    total: points.reduce((total, point) => total + point, 0),
    breakdown,
  };
}

/** 基準時間と、基準時間に対する0点になる時間の倍率から速さの採点規則を作る。 */
export function createSpeedScoreRule(
  fullScoreMs: number,
  zeroScoreRatio: number,
): SpeedScoreRule {
  return { fullScoreMs, zeroScoreMs: fullScoreMs * zeroScoreRatio };
}

/** 速さの点。1点単位に四捨五入し、0点を下回らない。 */
export function calculateSpeedScore(
  maximum: number,
  elapsedMs: number,
  { fullScoreMs, zeroScoreMs, overtimeStepMs }: SpeedScoreRule,
): number {
  const overtimeMs = Math.max(0, elapsedMs - fullScoreMs);
  const countedOvertimeMs =
    overtimeStepMs === undefined
      ? overtimeMs
      : Math.ceil(overtimeMs / overtimeStepMs) * overtimeStepMs;
  return calculateLinearScore(
    maximum,
    1 - countedOvertimeMs / (zeroScoreMs - fullScoreMs),
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateTimeDeltaMs(
  elapsedMs: number,
  { fullScoreMs }: SpeedScoreRule,
): number {
  return elapsedMs - fullScoreMs;
}
