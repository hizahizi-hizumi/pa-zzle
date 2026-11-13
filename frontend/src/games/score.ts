export type ScoreItem = "accuracy" | "efficiency" | "speed" | "stability";

/** 評価項目ごとの満点。並び順は結果画面に出す順。 */
export type ScoreMaximums<Item extends ScoreItem> = Readonly<
  Record<Item, number>
>;

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

export function calculateLinearScore(maximum: number, ratio: number): number {
  return Math.round(maximum * clampUnit(ratio));
}

export function subtractWithFloor(maximum: number, penalty: number): number {
  return Math.max(0, maximum - penalty);
}

export function sumPlayScore<Item extends ScoreItem>(
  breakdown: Record<Item, number>,
): PlayScore<Item> {
  const points: number[] = Object.values(breakdown);
  return {
    total: points.reduce((total, point) => total + point, 0),
    breakdown,
  };
}

export function createSpeedScoreRule(
  fullScoreMs: number,
  zeroScoreRatio: number,
): SpeedScoreRule {
  return { fullScoreMs, zeroScoreMs: fullScoreMs * zeroScoreRatio };
}

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

export function calculateTimeDeltaMs(
  elapsedMs: number,
  { fullScoreMs }: SpeedScoreRule,
): number {
  return elapsedMs - fullScoreMs;
}
