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

/** 島の数の下限（盤面のマスの数に対する割合）。島は置ける所が尽きるまで広げ、下限に届かない盤面は作り直す。 */
export const bridgesIslandDensities = [0.22, 0.24, 0.26] as const;

export type BridgesIslandDensity = (typeof bridgesIslandDensities)[number];

/** 架ける橋を2本にする確率。大きいほど数字が大きくなり、2本と1本の配分を読む所が増える。 */
export const bridgesDoubleBridgeRates = [0.5, 0.65] as const;

export type BridgesDoubleBridgeRate = (typeof bridgesDoubleBridgeRates)[number];

/** 島を置いたとき、ほかの向きの島にも橋を足して輪を作る確率。 */
export const bridgesExtraBridgeRates = [0.25, 0.45] as const;

export type BridgesExtraBridgeRate = (typeof bridgesExtraBridgeRates)[number];

/** 島を置く代わりに、架けた橋の途中に島を差して橋を2本に分ける確率（分割）。島の数を増やす。 */
export const bridgesSplitRates = [0.2, 0.45] as const;

export type BridgesSplitRate = (typeof bridgesSplitRates)[number];

/**
 * 広げた盤面の解を、人が読む量の多い盤面へ磨く焼きなましの回数の上限（`refineBridgesLayout`）。0 なら磨かない。
 * 磨くほど、数字の読みで止まり、つながりや1手の先読みを要る盤面に寄る。どのレベルに入るかは分析で決める。
 */
export const bridgesRefinementSteps = [0, 150, 500, 1500, 2000] as const;

export type BridgesRefinementSteps = (typeof bridgesRefinementSteps)[number];

/**
 * 磨くときに読みの量を増やす向き（`refineBridgesLayout`）。どのレベルに入るかは分析で決める。
 * - `entry`: 読みを増やさず、配分の読みを1か所までにして、数字と形の質だけを整える。
 * - `count`: 配分（少なくとも1本）と2島を閉じない読みを増やし、組の読みと1手の先読みは減らす。
 * - `closure`: つながりの読み（閉じない読み・唯一の通り道・交差）を増やし、1手の先読みは減らす。
 * - `lookahead`: 1手の先読み、とくに組が閉じるのを見る先読みと続けて要る先読みを増やす。
 */
export const bridgesRefinementGoals = [
  "entry",
  "count",
  "closure",
  "lookahead",
] as const;

export type BridgesRefinementGoal = (typeof bridgesRefinementGoals)[number];

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。 */
export const BRIDGES_GENERATOR_VERSION = "6";

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
  refinementSteps: BridgesRefinementSteps;
  refinementGoal: BridgesRefinementGoal;
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
 * 例: 10×10・島の密度の下限0.26・2本0.65・輪0.25・分割0.45・磨く回数 500・磨く向き closure・候補番号 3 は
 * `br-10-d26-p65-e25-s45-r500-closure-3`。
 */
export function createBridgesProblemIdentity(
  conditions: BridgesGenerationConditions,
  candidateIndex: number,
): BridgesProblemIdentity {
  const {
    size,
    islandDensity,
    doubleBridgeRate,
    extraBridgeRate,
    splitRate,
    refinementSteps,
    refinementGoal,
  } = conditions;
  return {
    generatorVersion: BRIDGES_GENERATOR_VERSION,
    seed: `br-${size}-d${toPercent(islandDensity)}-p${toPercent(doubleBridgeRate)}-e${toPercent(extraBridgeRate)}-s${toPercent(splitRate)}-r${refinementSteps}-${refinementGoal}-${candidateIndex}`,
    conditions: {
      size,
      islandDensity,
      doubleBridgeRate,
      extraBridgeRate,
      splitRate,
      refinementSteps,
      refinementGoal,
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
    isOneOf(bridgesSplitRates, value.splitRate) &&
    isOneOf(bridgesRefinementSteps, value.refinementSteps) &&
    isOneOf(bridgesRefinementGoals, value.refinementGoal)
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
