export type ScoreItem = "accuracy" | "efficiency" | "speed" | "stability";

/** 並び順は結果画面に出す順。 */
export type ScoreMaximums<Item extends ScoreItem> = Readonly<
  Record<Item, number>
>;

export type PlayScore<Item extends ScoreItem> = {
  total: number;
  breakdown: Record<Item, number>;
};

/**
 * 速さの採点規則。基準時間以内で満点とし、超えた分は `calculateSpeedScoreRatio` の曲線で減らす。
 * `zeroScoreMs` は曲線の傾きを決める時間で、減り始めの直線をそのまま延ばすと0点になる時間。実際には0点にならない。
 * `overtimeStepMs` があれば、超過時間をその幅で切り上げてから減らす。
 */
export type SpeedScoreRule = {
  fullScoreMs: number;
  zeroScoreMs: number;
  overtimeStepMs?: number;
};

/**
 * 速さの割合が、この値に下がるまでは超過時間に比例して減らし、その先は緩やかな曲線に切り替える。
 * 切り替えより上は前の直線のままなので、満点・`perfect`・`great` に届く条件は直線の採点と変わらない。
 * どのゲームでも速さの配点のこの割合では、ほかが満点でも `great` に届かない（40点 × 0.7 = 28点 < 30点）。
 */
export const SPEED_SCORE_CURVE_KNEE_RATIO = 0.7;
/**
 * 速さの割合の下限。解き切った人が速さで極端に低い点を見ないよう、どれだけ長くかかってもこの割合は残す。
 * 直線なら0点になる時間で、およそ0.4が残る。
 */
export const SPEED_SCORE_FLOOR_RATIO = 0.35;

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

/**
 * 超過の度合い（超過時間 ÷ 直線で0点になるまでの幅）から速さの割合を求める。
 * 切り替えまでは直線、その先は下限へ近づく指数の曲線で、切り替えの点で傾きをつなぐ。長くかかるほど減り方が緩やかになる。
 */
export function calculateSpeedScoreRatio(overtimeRatio: number): number {
  const linearRatio = 1 - Math.max(0, overtimeRatio);
  if (linearRatio >= SPEED_SCORE_CURVE_KNEE_RATIO) {
    return linearRatio;
  }
  const curveRange = SPEED_SCORE_CURVE_KNEE_RATIO - SPEED_SCORE_FLOOR_RATIO;
  return (
    SPEED_SCORE_FLOOR_RATIO +
    curveRange *
      Math.exp((linearRatio - SPEED_SCORE_CURVE_KNEE_RATIO) / curveRange)
  );
}

/** どれだけ長くかかっても残る速さの点。 */
export function calculateSpeedFloorScore(maximum: number): number {
  return calculateLinearScore(maximum, SPEED_SCORE_FLOOR_RATIO);
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
    calculateSpeedScoreRatio(countedOvertimeMs / (zeroScoreMs - fullScoreMs)),
  );
}

export function calculateTimeDeltaMs(
  elapsedMs: number,
  { fullScoreMs }: SpeedScoreRule,
): number {
  return elapsedMs - fullScoreMs;
}
