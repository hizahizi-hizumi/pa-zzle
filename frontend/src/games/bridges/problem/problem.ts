import {
  assertBridgesBoard,
  type BridgesBoard,
} from "@/games/bridges/puzzle/board";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { isNonEmptyString, isRecordObject } from "@/lib/type-guards";

/**
 * 1問を遊ぶためのデータ。盤面（島の位置と数字）だけを持ち、解の橋は持たない。
 * クリアは規則で判定し（`isBridgesSolved`）、問題は一意解なので解との照合は要らない。
 */
export type BridgesProblem = BridgesBoard;

/** 生成器が扱う正方形の盤面の一辺。どのレベルでどの大きさを出すかは難易度の組み合わせ定義が決める。 */
export const bridgesBoardSizes = [6, 7, 8, 9, 10] as const;

export type BridgesBoardSize = (typeof bridgesBoardSizes)[number];

/** 島の数の目標（盤面のマスの数に対する割合）。島を伸ばせる所が尽きると目標に届かない。 */
export const bridgesIslandDensities = [0.24, 0.3] as const;

export type BridgesIslandDensity = (typeof bridgesIslandDensities)[number];

/** 作る橋を2本にする確率。小さいほど 1・2 の島が増え、つながりの読みが要る問題が出やすい。 */
export const bridgesDoubleBridgeRates = [0.1, 0.2, 0.3] as const;

export type BridgesDoubleBridgeRate = (typeof bridgesDoubleBridgeRates)[number];

/** 木を作った後、まだ橋の無い島の組に輪を作る橋を足す確率。 */
export const bridgesExtraBridgeRates = [0, 0.15] as const;

export type BridgesExtraBridgeRate = (typeof bridgesExtraBridgeRates)[number];

/** 木を育てる途中で、既にある橋の途中に島を差して橋を2本に分ける確率（分割）。島の数を増やす。 */
export const bridgesSplitRates = [0, 0.2] as const;

export type BridgesSplitRate = (typeof bridgesSplitRates)[number];

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。 */
export const BRIDGES_GENERATOR_VERSION = "2";

/**
 * 候補を作る条件。どれも難易度の判定条件ではなく、候補の分布を寄せる生成条件。
 * 問題のレベルは、作った問題を分析・分類して決める。
 */
export type BridgesGenerationConditions = {
  size: BridgesBoardSize;
  islandDensity: BridgesIslandDensity;
  doubleBridgeRate: BridgesDoubleBridgeRate;
  extraBridgeRate: BridgesExtraBridgeRate;
  splitRate: BridgesSplitRate;
};

/** 同じ問題を再現するための情報。記録から同じ問題を引き直すときに使う。 */
export type BridgesProblemIdentity = {
  generatorVersion: typeof BRIDGES_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: BridgesGenerationConditions;
};

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も読み込む。 */
export type BridgesRecordedProblemIdentity = RecordedProblemIdentity;

/** 問題と、それを再現するための情報。 */
export type BridgesIdentifiedProblem = {
  problem: BridgesProblem;
  identity: BridgesProblemIdentity;
};

function toPercent(rate: number): number {
  return Math.round(rate * 100);
}

/**
 * 生成条件と候補番号から identity を作る。seed は条件ごとに別の系列になるよう条件を含め、割合は百分率の整数で書く。
 * 例: 10×10・密度0.3・2本0.1・輪0.15・分割0.2・候補番号 3 は `br-10-d30-p10-e15-s20-3`。
 */
export function createBridgesProblemIdentity(
  conditions: BridgesGenerationConditions,
  candidateIndex: number,
): BridgesProblemIdentity {
  const { size, islandDensity, doubleBridgeRate, extraBridgeRate, splitRate } =
    conditions;
  return {
    generatorVersion: BRIDGES_GENERATOR_VERSION,
    seed: `br-${size}-d${toPercent(islandDensity)}-p${toPercent(doubleBridgeRate)}-e${toPercent(extraBridgeRate)}-s${toPercent(splitRate)}-${candidateIndex}`,
    conditions: {
      size,
      islandDensity,
      doubleBridgeRate,
      extraBridgeRate,
      splitRate,
    },
  };
}

function isOneOf<T>(values: readonly T[], value: unknown): value is T {
  return values.some((candidate) => candidate === value);
}

/** 外部から読み戻した値が、今の生成器で扱える生成条件かを確かめる。 */
export function isBridgesGenerationConditions(
  value: unknown,
): value is BridgesGenerationConditions {
  return (
    isRecordObject(value) &&
    isOneOf(bridgesBoardSizes, value.size) &&
    isOneOf(bridgesIslandDensities, value.islandDensity) &&
    isOneOf(bridgesDoubleBridgeRates, value.doubleBridgeRate) &&
    isOneOf(bridgesExtraBridgeRates, value.extraBridgeRate) &&
    isOneOf(bridgesSplitRates, value.splitRate)
  );
}

/** 記録など外部から読み戻した値が、今の生成器で扱える識別情報かを確かめる。 */
export function isBridgesProblemIdentity(
  value: unknown,
): value is BridgesProblemIdentity {
  return (
    isRecordObject(value) &&
    value.generatorVersion === BRIDGES_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    isBridgesGenerationConditions(value.conditions)
  );
}

/** 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。 */
export function isBridgesRecordedProblemIdentity(
  value: unknown,
): value is BridgesRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: BRIDGES_GENERATOR_VERSION,
    isProblemIdentity: isBridgesProblemIdentity,
  });
}

/**
 * 問題の形を確かめる。盤面の形が正しく、生成器が扱う一辺の正方形であること。
 * プレイ画面は正方形の枠に盤面を描き、押した位置を同じ枠から求めるので、正方形でない盤面は受け付けない。
 * 一意解であることは探索を要するので、ここでは確かめない（問題集の生成と検証で確かめる）。
 */
export function assertBridgesProblem(problem: BridgesProblem): void {
  assertBridgesBoard(problem);
  if (
    problem.width !== problem.height ||
    !bridgesBoardSizes.some((size) => size === problem.width)
  ) {
    throw new RangeError(
      `Bridges problem must be a square board of ${bridgesBoardSizes.join(", ")} cells`,
    );
  }
}
