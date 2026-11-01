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
import { isNonEmptyString, isRecordObject } from "@/lib/type-guards";

/**
 * 1問を遊ぶためのデータ。盤面（壁マス・仕切り・始点）だけを持ち、解の道は持たない。
 * クリアは規則で判定し（`isHamiltonianPathSolved`）、問題は一意解なので解との照合は要らない。
 */
export type HamiltonianPathProblem = HamiltonianPathBoard;

/** 生成器が扱う盤面サイズ。どのレベルでどの大きさを出すかは難易度の組み合わせ定義が決める。 */
export const hamiltonianPathBoardSizes = [5, 6, 7, 8] as const;

export type HamiltonianPathBoardSize =
  (typeof hamiltonianPathBoardSizes)[number];

/** 生成器へ渡す壁率（盤面のマスのうち壁マスにする割合）。難易度の判定条件ではなく、候補の分布を寄せる生成条件。 */
export const hamiltonianPathWallRatios = [0, 0.15] as const;

export type HamiltonianPathWallRatio =
  (typeof hamiltonianPathWallRatios)[number];

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。 */
export const HAMILTONIAN_PATH_GENERATOR_VERSION = "1";

export type HamiltonianPathGenerationConditions = {
  size: HamiltonianPathBoardSize;
  wallRatio: HamiltonianPathWallRatio;
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
 * 生成条件と候補番号から identity を作る。seed は条件ごとに別の系列になるよう条件を含める。
 * 壁率は百分率の整数で書く。例: 8×8・壁率0.15・候補番号 3 は `hp-8-15-3`。
 */
export function createHamiltonianPathProblemIdentity(
  size: HamiltonianPathBoardSize,
  wallRatio: HamiltonianPathWallRatio,
  candidateIndex: number,
): HamiltonianPathProblemIdentity {
  return {
    generatorVersion: HAMILTONIAN_PATH_GENERATOR_VERSION,
    seed: `hp-${size}-${Math.round(wallRatio * 100)}-${candidateIndex}`,
    conditions: { size, wallRatio },
  };
}

export function isHamiltonianPathBoardSize(
  value: unknown,
): value is HamiltonianPathBoardSize {
  return hamiltonianPathBoardSizes.some((size) => size === value);
}

export function isHamiltonianPathWallRatio(
  value: unknown,
): value is HamiltonianPathWallRatio {
  return hamiltonianPathWallRatios.some((ratio) => ratio === value);
}

/**
 * 問題の形を確かめる。盤面の形が正しく、有効マスが仕切りを除く隣接で1つにつながっていること。
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

  const { size, wallRatio } = value.conditions;
  return (
    value.generatorVersion === HAMILTONIAN_PATH_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    isHamiltonianPathBoardSize(size) &&
    isHamiltonianPathWallRatio(wallRatio)
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
