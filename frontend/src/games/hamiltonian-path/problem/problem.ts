import {
  assertHamiltonianPathBoard,
  type HamiltonianPathBoard,
} from "@/games/hamiltonian-path/puzzle/board";
import { areHamiltonianPathOpenCellsConnected } from "@/games/hamiltonian-path/puzzle/rules";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  isNonEmptyString,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

/**
 * 1問を遊ぶためのデータ。盤面（穴・始点）だけを持ち、解の道は持たない。
 * クリアは規則で判定し（`isHamiltonianPathSolved`）、問題は一意解なので解との照合は要らない。
 */
export type HamiltonianPathProblem = HamiltonianPathBoard;

/** 生成器が扱う盤面サイズ（穴を含む枠の一辺）。どのレベルでどの大きさを出すかは難易度の組み合わせ定義が決める。 */
export const hamiltonianPathBoardSizes = [5, 6, 7, 8] as const;

export type HamiltonianPathBoardSize =
  (typeof hamiltonianPathBoardSizes)[number];

/**
 * 生成器へ渡す、仮置きの回数の目標。一意解に着いた後も、人間向け解法器の仮置きの回数がこれに届くまで穴を動かし続ける。
 * 0 なら一意解に着いた盤面をそのまま採る。難易度の判定条件ではなく、候補の分布を上のレベルへ寄せる生成条件。
 */
export const hamiltonianPathTargetAssumptionCounts = [0, 4, 7] as const;

export type HamiltonianPathTargetAssumptionCount =
  (typeof hamiltonianPathTargetAssumptionCounts)[number];

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。 */
export const HAMILTONIAN_PATH_GENERATOR_VERSION = "2";

export type HamiltonianPathGenerationConditions = {
  size: HamiltonianPathBoardSize;
  targetAssumptionCount: HamiltonianPathTargetAssumptionCount;
};

/** 同じ問題を再現するための情報。記録から同じ問題を引き直すときに使う。 */
export type HamiltonianPathProblemIdentity = {
  generatorVersion: typeof HAMILTONIAN_PATH_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: HamiltonianPathGenerationConditions;
};

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も読み込む。 */
export type HamiltonianPathRecordedProblemIdentity = RecordedProblemIdentity;

/** 問題と、それを再現するための情報。 */
export type HamiltonianPathIdentifiedProblem = {
  problem: HamiltonianPathProblem;
  identity: HamiltonianPathProblemIdentity;
};

/**
 * 問題を解き切る作業の量。速さの基準時間を問題ごとに決めるために使い、難易度そのものは表さない。
 * - `openCellCount`: 道が通るマスの数（なぞる長さ）。
 * - `assumptionCount`: 人間向け解法器で、局所・分断・パリティの推論で止まり、1段仮置きで辺を決めた回数（先読みの回数）。
 * - `refutationStepCount`: 仮置きごとの、仮置きから矛盾が出るまでの推論の手数の合計（先読みの量）。
 * - `longestRefutationLength`: そのうち最も長い先読みの手数。仮置きが無ければ0。
 * - `fatalBranchCount`: 始点から解の道を引き進めるときに、全マスを通れなくなる手を含む分岐の数（迷う地点の数）。
 */
export type HamiltonianPathSolveWorkload = {
  openCellCount: number;
  assumptionCount: number;
  refutationStepCount: number;
  longestRefutationLength: number;
  fatalBranchCount: number;
};

/**
 * 記録など外部から読み戻した値が、問題を解き切る作業の量として読めるかを確かめる。
 * 最も長い先読みは先読みの手数の合計の一部なので、合計を超えない。
 */
export function isHamiltonianPathSolveWorkload(
  value: unknown,
): value is HamiltonianPathSolveWorkload {
  if (!isRecordObject(value)) {
    return false;
  }

  const {
    openCellCount,
    assumptionCount,
    refutationStepCount,
    longestRefutationLength,
    fatalBranchCount,
  } = value;
  return (
    isPositiveInteger(openCellCount) &&
    isNonNegativeInteger(assumptionCount) &&
    isNonNegativeInteger(refutationStepCount) &&
    isNonNegativeInteger(longestRefutationLength) &&
    isNonNegativeInteger(fatalBranchCount) &&
    longestRefutationLength <= refutationStepCount
  );
}

/** 作業の量のなぞる長さが、identity の生成条件の枠に収まるか。穴の数は生成で決まるので、枠のマスの数を上限にする。 */
export function isHamiltonianPathWorkloadOfIdentity(
  workload: HamiltonianPathSolveWorkload,
  identity: HamiltonianPathProblemIdentity,
): boolean {
  const { size } = identity.conditions;
  return workload.openCellCount <= size * size;
}

/**
 * 生成条件と候補番号から identity を作る。seed は条件ごとに別の系列になるよう条件を含める。
 * 例: 8×8・仮置きの回数の目標 7・候補番号 3 は `hp-8-t7-3`。
 */
export function createHamiltonianPathProblemIdentity(
  size: HamiltonianPathBoardSize,
  targetAssumptionCount: HamiltonianPathTargetAssumptionCount,
  candidateIndex: number,
): HamiltonianPathProblemIdentity {
  return {
    generatorVersion: HAMILTONIAN_PATH_GENERATOR_VERSION,
    seed: `hp-${size}-t${targetAssumptionCount}-${candidateIndex}`,
    conditions: { size, targetAssumptionCount },
  };
}

export function isHamiltonianPathBoardSize(
  value: unknown,
): value is HamiltonianPathBoardSize {
  return hamiltonianPathBoardSizes.some((size) => size === value);
}

export function isHamiltonianPathTargetAssumptionCount(
  value: unknown,
): value is HamiltonianPathTargetAssumptionCount {
  return hamiltonianPathTargetAssumptionCounts.some((count) => count === value);
}

/**
 * 問題の形を確かめる。盤面の形が正しく、穴でないマスが上下左右の隣接で1つにつながっていること。
 * 一意解であることは探索を要するので、ここでは確かめない（問題集の生成と検証で確かめる）。
 */
export function assertHamiltonianPathProblem(
  problem: HamiltonianPathProblem,
): void {
  assertHamiltonianPathBoard(problem);
  if (!areHamiltonianPathOpenCellsConnected(problem)) {
    throw new Error("Hamiltonian path open cells must be connected");
  }
}

/** 記録など外部から読み戻した値が、現在の生成器で扱える識別情報かを確かめる。 */
export function isHamiltonianPathProblemIdentity(
  value: unknown,
): value is HamiltonianPathProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { size, targetAssumptionCount } = value.conditions;
  return (
    value.generatorVersion === HAMILTONIAN_PATH_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    isHamiltonianPathBoardSize(size) &&
    isHamiltonianPathTargetAssumptionCount(targetAssumptionCount)
  );
}

/** 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。 */
export function isHamiltonianPathRecordedProblemIdentity(
  value: unknown,
): value is HamiltonianPathRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: HAMILTONIAN_PATH_GENERATOR_VERSION,
    isProblemIdentity: isHamiltonianPathProblemIdentity,
  });
}
