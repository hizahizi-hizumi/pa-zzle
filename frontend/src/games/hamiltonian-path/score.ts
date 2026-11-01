import type { HamiltonianPathSolveWorkload } from "@/games/hamiltonian-path/problem/problem";
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
 * 先を読んで道筋を決め、引き直しを少なく、迷わず速く引き切ることを称える。
 * 上位レベルは解法器でも仮置き（先読み）を要し、引いて確かめること自体を強く罰すると遊び方を罰するので、速さを主にし、引き直しは軽く数える。
 * 配点・減点幅・基準時間の係数はすべて仮置きで、実プレイで校正する（`ハミルトン路成績評価.md`）。
 */
export const HAMILTONIAN_PATH_SCORE_MAXIMUMS = {
  speed: 60,
  accuracy: 40,
} as const satisfies ScoreMaximums<"speed" | "accuracy">;

/**
 * 引き直し1回ごとの正確さの減点（仮置き）。
 * 押し間違いを直した程度（3回まで）なら、ほかが満点で great に残る。
 * 待った・盤面を戻す・戻したマスの数は減点しない。待ったや盤面を戻すで戻した後に別の向きへ引けば、引き直しとして数えるため。
 */
export const HAMILTONIAN_PATH_BACKTRACK_PENALTY = 3;

/** 基準時間の係数（仮置き）。盤面を見渡して始める時間。 */
export const HAMILTONIAN_PATH_SPEED_INITIAL_RECOGNITION_MS = 5_000;
/** 基準時間の係数（仮置き）。道が通るマス1つをなぞる時間。 */
export const HAMILTONIAN_PATH_SPEED_PER_OPEN_CELL_MS = 500;
/** 基準時間の係数（仮置き）。引き進めると全マスを通れなくなる手を含む分岐1つで、向きを読み分ける時間。 */
export const HAMILTONIAN_PATH_SPEED_PER_FATAL_BRANCH_MS = 3_000;
/** 基準時間の係数（仮置き）。局所の推論で止まり、先を読む箇所を選ぶ1回ごとの時間。 */
export const HAMILTONIAN_PATH_SPEED_PER_ASSUMPTION_MS = 3_000;
/** 基準時間の係数（仮置き）。先読みの1手（仮置きから矛盾が見えるまでの推論1手）ごとの時間。 */
export const HAMILTONIAN_PATH_SPEED_PER_REFUTATION_STEP_MS = 1_000;
/**
 * 基準時間に数える先読みの手数の合計の上限（仮置き）。
 * 解法器は仮置きの候補を決まった順に試すので、手数の合計の裾が長い（問題集の最大287手）。
 * 人間は見込みの高い候補から読むとみなし、レベル5 の9割の問題が収まる手数で打ち切る。
 */
export const HAMILTONIAN_PATH_SPEED_REFUTATION_STEP_LIMIT = 120;

/**
 * 0点になる時間の、基準時間に対する倍率（仮置き）。
 * 仮置きを要する問題は読みの当たり外れで時間がぶれるので、バイナリパズル（2倍）より緩くし、
 * 基準時間の1.2倍で速さ −6点、1.5倍で −15点にとどめる。
 */
export const HAMILTONIAN_PATH_SPEED_ZERO_SCORE_RATIO = 3;

export type HamiltonianPathPlayScore = PlayScore<
  keyof typeof HAMILTONIAN_PATH_SCORE_MAXIMUMS
>;

type HamiltonianPathTimeDeltaInput = {
  elapsedMs: number;
  workload: HamiltonianPathSolveWorkload;
};

type HamiltonianPathPlayScoreInput = HamiltonianPathTimeDeltaInput & {
  backtrackCount: number;
};

/**
 * 問題ごとの速さ満点の基準時間。
 * 盤面を見渡す時間に、なぞるマスの数、迷う分岐の数、先を読む回数、先読みの手数の合計（上限あり）に応じた時間を足す。
 * 問題を解き切る作業の量だけから決め、難易度そのものは使わない。
 */
export function calculateHamiltonianPathSpeedFullScoreMs({
  openCellCount,
  fatalBranchCount,
  assumptionCount,
  refutationStepCount,
}: HamiltonianPathSolveWorkload): number {
  return (
    HAMILTONIAN_PATH_SPEED_INITIAL_RECOGNITION_MS +
    Math.max(0, openCellCount) * HAMILTONIAN_PATH_SPEED_PER_OPEN_CELL_MS +
    Math.max(0, fatalBranchCount) * HAMILTONIAN_PATH_SPEED_PER_FATAL_BRANCH_MS +
    Math.max(0, assumptionCount) * HAMILTONIAN_PATH_SPEED_PER_ASSUMPTION_MS +
    Math.min(
      Math.max(0, refutationStepCount),
      HAMILTONIAN_PATH_SPEED_REFUTATION_STEP_LIMIT,
    ) *
      HAMILTONIAN_PATH_SPEED_PER_REFUTATION_STEP_MS
  );
}

export function calculateHamiltonianPathSpeedScoreRule(
  workload: HamiltonianPathSolveWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateHamiltonianPathSpeedFullScoreMs(workload),
    HAMILTONIAN_PATH_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateHamiltonianPathTimeDeltaMs({
  elapsedMs,
  workload,
}: HamiltonianPathTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateHamiltonianPathSpeedScoreRule(workload),
  );
}

/** 正確さは引き直しの回数だけで減点する。解の道との照合は使わない。 */
export function calculateHamiltonianPathPlayScore({
  elapsedMs,
  backtrackCount,
  workload,
}: HamiltonianPathPlayScoreInput): HamiltonianPathPlayScore {
  const speed = calculateSpeedScore(
    HAMILTONIAN_PATH_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateHamiltonianPathSpeedScoreRule(workload),
  );
  const accuracy = subtractWithFloor(
    HAMILTONIAN_PATH_SCORE_MAXIMUMS.accuracy,
    backtrackCount * HAMILTONIAN_PATH_BACKTRACK_PENALTY,
  );

  return sumPlayScore({ speed, accuracy });
}
