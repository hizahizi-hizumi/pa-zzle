import type { GameResultLevel } from "@/games/result";
import type { TakuzuSolveWorkload } from "@/games/takuzu/problem/problem";

/**
 * 盤面を読んで確定したマスだけを置き、置き直しをせずに解き切ることを最も称え、その上で速さを称える。
 * 推測なしに解ける問題だけを出すので、読みの正確さを速さより重くする。
 */
export const TAKUZU_SCORE_MAXIMUMS = {
  accuracy: 60,
  speed: 40,
} as const;

/**
 * 置き直し1回ごとの正確さの減点。
 * 押し間違いを直した程度（2回まで）なら great に残り、試し置きを重ねて5回以上直したプレイは速さによらず good に届かない重さにする。
 */
export const TAKUZU_CORRECTION_PENALTY = 5;

/**
 * やり直し1回ごとの正確さの減点。
 * やり直しで消えたマスは置き直しに数えないので、試し置きの跡を消せる分を含めて重くする。
 * 1回やり直せば、ほかが完璧でも最高で good とする。
 */
export const TAKUZU_RESTART_PENALTY = 15;

export const TAKUZU_SPEED_INITIAL_RECOGNITION_MS = 10_000;
export const TAKUZU_SPEED_PER_EMPTY_CELL_MS = 2_000;
export const TAKUZU_SPEED_PER_ROUND_MS = 3_000;
export const TAKUZU_SPEED_PER_LINE_READING_ROUND_MS = 10_000;

export type TakuzuPlayScore = {
  total: number;
  breakdown: {
    accuracy: number;
    speed: number;
  };
};

type TakuzuTimeDeltaInput = {
  elapsedMs: number;
  workload: TakuzuSolveWorkload;
};

type TakuzuPlayScoreInput = TakuzuTimeDeltaInput & {
  correctionCount: number;
  restartCount: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 問題ごとの速さ満点の基準時間。
 * 盤面把握の時間に、タイルを置く数、次の一手を探し直す局面の数、行・列全体を読む局面の数に応じた時間を足す。
 * 問題を解き切る作業の量だけから決め、難易度そのものは使わない。
 */
export function calculateTakuzuSpeedFullScoreMs({
  emptyCellCount,
  roundCount,
  lineReadingRoundCount,
}: TakuzuSolveWorkload): number {
  return (
    TAKUZU_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, emptyCellCount) * TAKUZU_SPEED_PER_EMPTY_CELL_MS +
    Math.max(0, roundCount) * TAKUZU_SPEED_PER_ROUND_MS +
    Math.max(0, lineReadingRoundCount) * TAKUZU_SPEED_PER_LINE_READING_ROUND_MS
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateTakuzuTimeDeltaMs({
  elapsedMs,
  workload,
}: TakuzuTimeDeltaInput): number {
  return elapsedMs - calculateTakuzuSpeedFullScoreMs(workload);
}

/**
 * - 正確さ: 置き直しとやり直しの回数に応じて減点する。解答との照合は使わない。
 * - 速さ: 基準時間以内で満点、超過に応じて線形に減らし、基準時間の2倍で0点とする。
 */
export function calculateTakuzuPlayScore({
  elapsedMs,
  correctionCount,
  restartCount,
  workload,
}: TakuzuPlayScoreInput): TakuzuPlayScore {
  const accuracy = Math.max(
    0,
    TAKUZU_SCORE_MAXIMUMS.accuracy -
      correctionCount * TAKUZU_CORRECTION_PENALTY -
      restartCount * TAKUZU_RESTART_PENALTY,
  );

  const speedFullScoreMs = calculateTakuzuSpeedFullScoreMs(workload);
  const overtimeMs = Math.max(0, elapsedMs - speedFullScoreMs);
  const speed = Math.round(
    TAKUZU_SCORE_MAXIMUMS.speed * clampUnit(1 - overtimeMs / speedFullScoreMs),
  );

  return {
    total: accuracy + speed,
    breakdown: { accuracy, speed },
  };
}

export function getTakuzuGameResultLevel(score: number): GameResultLevel {
  if (score >= 100) {
    return "perfect";
  }
  if (score >= 90) {
    return "great";
  }
  if (score >= 80) {
    return "good";
  }
  return "clear";
}
