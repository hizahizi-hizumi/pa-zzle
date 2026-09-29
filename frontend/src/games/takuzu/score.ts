import type { TakuzuSolveWorkload } from "@/games/takuzu/problem/problem";

/**
 * 盤面を読んで確定したマスだけを置き、置き直しをせずに解き切ることを最も称え、その上で速さを称える。
 * 推測なしに解ける問題だけを出すので、読みの正確性を速さより重くする。
 */
export const TAKUZU_SCORE_MAXIMUMS = {
  accuracy: 60,
  speed: 40,
} as const;

/**
 * 置き直し1回ごとの正確性の減点。
 * 押し間違いを直した程度（2回まで）なら great に残り、試し置きを重ねて5回以上直したプレイは速さによらず good に届かない重さにする。
 */
export const TAKUZU_CORRECTION_PENALTY = 5;

/**
 * 盤面を戻した1回ごとの正確性の減点。
 * 盤面を戻して消えたマスは置き直しに数えないので、試し置きの跡を消せる分を含めて重くする。
 * 1回戻せば、ほかが完璧でも最高で good とする。
 */
export const TAKUZU_RESTART_PENALTY = 15;

/**
 * 待った1回ごとの正確性の減点。ナンプレの待ったと同じ重さにする。
 * 待ったで取り消した操作は置き直しに数えないので、押し間違いをすぐ取り消したプレイは置き直したプレイより軽く扱い、
 * 試し置きを待ったで戻し続けたプレイにも回数に応じた減点を残す。
 */
export const TAKUZU_UNDO_PENALTY = 2;

export const TAKUZU_SPEED_INITIAL_RECOGNITION_MS = 10_000;
export const TAKUZU_SPEED_PER_EMPTY_CELL_MS = 2_000;
export const TAKUZU_SPEED_PER_ROUND_MS = 3_000;
export const TAKUZU_SPEED_PER_LINE_READING_ROUND_MS = 10_000;

/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const TAKUZU_SPEED_ZERO_SCORE_RATIO = 2;

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
  undoCount: number;
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

/** 速さが0点になる時間。基準時間から、ここまで超過に応じて線形に減らす。 */
export function calculateTakuzuSpeedZeroScoreMs(
  workload: TakuzuSolveWorkload,
): number {
  return (
    calculateTakuzuSpeedFullScoreMs(workload) * TAKUZU_SPEED_ZERO_SCORE_RATIO
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
 * - 正確性: 置き直しの回数、盤面を戻した回数、待ったの回数に応じて減点する。解答との照合は使わない。
 * - 速さ: 基準時間以内で満点、超過に応じて線形に減らし、0点になる時間（基準時間の2倍）で0点とする。
 */
export function calculateTakuzuPlayScore({
  elapsedMs,
  correctionCount,
  restartCount,
  undoCount,
  workload,
}: TakuzuPlayScoreInput): TakuzuPlayScore {
  const accuracy = Math.max(
    0,
    TAKUZU_SCORE_MAXIMUMS.accuracy -
      correctionCount * TAKUZU_CORRECTION_PENALTY -
      restartCount * TAKUZU_RESTART_PENALTY -
      undoCount * TAKUZU_UNDO_PENALTY,
  );

  const speedFullScoreMs = calculateTakuzuSpeedFullScoreMs(workload);
  const speedZeroScoreMs = calculateTakuzuSpeedZeroScoreMs(workload);
  const overtimeMs = Math.max(0, elapsedMs - speedFullScoreMs);
  const speed = Math.round(
    TAKUZU_SCORE_MAXIMUMS.speed *
      clampUnit(1 - overtimeMs / (speedZeroScoreMs - speedFullScoreMs)),
  );

  return {
    total: accuracy + speed,
    breakdown: { accuracy, speed },
  };
}
