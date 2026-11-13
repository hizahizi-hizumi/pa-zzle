import type { HitofudePuzzleSolveWorkload } from "@/games/hitofude-puzzle/problem/problem";
import {
  calculateSpeedScore,
  calculateTimeDeltaMs,
  createSpeedScoreRule,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  subtractWithFloor,
  sumPlayScore,
} from "@/games/score";

/**
 * 配点・減点幅・基準時間の係数はすべて暫定値で、実プレイで校正する（`ハミルトン路成績評価.md`）。
 */
export const HITOFUDE_PUZZLE_SCORE_MAXIMUMS = {
  speed: 60,
  accuracy: 40,
} as const satisfies ScoreMaximums<"speed" | "accuracy">;

/**
 * 引き直し1回ごとの正確さの減点（暫定値）。
 * 押し間違いを直した程度（3回まで）なら、ほかが満点で great に残る。
 */
export const HITOFUDE_PUZZLE_BACKTRACK_PENALTY = 3;

/** 基準時間の係数（暫定値）。盤面を見渡して始める時間。 */
export const HITOFUDE_PUZZLE_SPEED_INITIAL_RECOGNITION_MS = 5_000;
/** 基準時間の係数（暫定値）。道が通るマス1つをなぞる時間。 */
export const HITOFUDE_PUZZLE_SPEED_PER_OPEN_CELL_MS = 500;
/** 基準時間の係数（暫定値）。引き進めると全マスを通れなくなる手を含む分岐1つで、向きを読み分ける時間。 */
export const HITOFUDE_PUZZLE_SPEED_PER_FATAL_BRANCH_MS = 3_000;
/** 基準時間の係数（暫定値）。局所の推論で止まり、先を読む箇所を選ぶ局面1つごとの時間。 */
export const HITOFUDE_PUZZLE_SPEED_PER_ASSUMPTION_MS = 3_000;
/** 基準時間の係数（暫定値）。先読みの1手（局面ごとの、試しに選んだ向きから矛盾が見えるまでの最も短い推論の1手）ごとの時間。 */
export const HITOFUDE_PUZZLE_SPEED_PER_REFUTATION_STEP_MS = 1_000;
/**
 * 基準時間に数える先読みの手数の合計の上限（暫定値）。
 * 先読みの局面を何度も重ねる問題では手数の合計の裾が長い。
 * 読みの当たり外れで時間がぶれる裾を基準時間に入れないよう、レベル5 の問題のおよそ9割が収まる手数で打ち切る。
 */
export const HITOFUDE_PUZZLE_SPEED_REFUTATION_STEP_LIMIT = 45;

/**
 * 0点になる時間の、基準時間に対する倍率（暫定値）。
 * 先読みを要する問題は読みの当たり外れで時間がぶれるので、バイナリパズル（2倍）より緩くし、
 * 基準時間の1.2倍で速さ −6点、1.5倍で −15点にとどめる。
 */
export const HITOFUDE_PUZZLE_SPEED_ZERO_SCORE_RATIO = 3;

export type HitofudePuzzlePlayScore = PlayScore<
  keyof typeof HITOFUDE_PUZZLE_SCORE_MAXIMUMS
>;

type HitofudePuzzleTimeDeltaInput = {
  elapsedMs: number;
  workload: HitofudePuzzleSolveWorkload;
};

type HitofudePuzzlePlayScoreInput = HitofudePuzzleTimeDeltaInput & {
  backtrackCount: number;
};

export function calculateHitofudePuzzleSpeedFullScoreMs({
  openCellCount,
  fatalBranchCount,
  assumptionCount,
  refutationStepCount,
}: HitofudePuzzleSolveWorkload): number {
  return (
    HITOFUDE_PUZZLE_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, openCellCount) * HITOFUDE_PUZZLE_SPEED_PER_OPEN_CELL_MS +
    Math.max(0, fatalBranchCount) * HITOFUDE_PUZZLE_SPEED_PER_FATAL_BRANCH_MS +
    Math.max(0, assumptionCount) * HITOFUDE_PUZZLE_SPEED_PER_ASSUMPTION_MS +
    Math.min(
      Math.max(0, refutationStepCount),
      HITOFUDE_PUZZLE_SPEED_REFUTATION_STEP_LIMIT,
    ) *
      HITOFUDE_PUZZLE_SPEED_PER_REFUTATION_STEP_MS
  );
}

export function calculateHitofudePuzzleSpeedScoreRule(
  workload: HitofudePuzzleSolveWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateHitofudePuzzleSpeedFullScoreMs(workload),
    HITOFUDE_PUZZLE_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateHitofudePuzzleTimeDeltaMs({
  elapsedMs,
  workload,
}: HitofudePuzzleTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateHitofudePuzzleSpeedScoreRule(workload),
  );
}

export function calculateHitofudePuzzlePlayScore({
  elapsedMs,
  backtrackCount,
  workload,
}: HitofudePuzzlePlayScoreInput): HitofudePuzzlePlayScore {
  const speed = calculateSpeedScore(
    HITOFUDE_PUZZLE_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateHitofudePuzzleSpeedScoreRule(workload),
  );
  // 正確さは引き直しの回数だけで減点する。解の道との照合は使わない。
  const accuracy = subtractWithFloor(
    HITOFUDE_PUZZLE_SCORE_MAXIMUMS.accuracy,
    backtrackCount * HITOFUDE_PUZZLE_BACKTRACK_PENALTY,
  );

  return sumPlayScore({ speed, accuracy });
}
