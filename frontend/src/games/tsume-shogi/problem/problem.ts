import type { ProblemSeed } from "@/games/problem-seed";
import { isTsumeShogiMateWithin } from "@/games/tsume-shogi/puzzle/mate-search";
import {
  applyTsumeShogiMove,
  formatTsumeShogiMoveUsi,
  isTsumeShogiCheckmate,
  isTsumeShogiDefenderInCheck,
  isTsumeShogiLegalMove,
  parseTsumeShogiMoveUsi,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  formatTsumeShogiPosition,
  getTsumeShogiSideToMove,
  parseTsumeShogiPosition,
  type TsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";

/**
 * 1問を遊ぶためのデータ。
 * - `initialPosition`: 攻方の手番の初期局面。玉方の持駒は駒箱。
 * - `plies`: 詰むまでの手数（奇数）。
 * - `mainLine`: 作意。攻方・玉方の順に交互に並び、最後は詰めた攻方の手。攻方の手はどの手番でも、残りの手数以内に
 *   詰むただ1つの王手で、玉方の手は玉方が自動で指す最長抵抗の応手。
 */
export type TsumeShogiProblem = {
  initialPosition: TsumeShogiPosition;
  plies: number;
  mainLine: readonly TsumeShogiMove[];
};

/** 問題を文字列だけで表す形。問題集・記録・診断に使う。 */
export type TsumeShogiProblemText = {
  sfen: string;
  mainLine: readonly string[];
};

/** 生成器が扱う手数。1手詰は通常の難易度の手数としては扱わないが、逆算の起点として作る。 */
export const tsumeShogiGenerationPlies = [1, 3, 5] as const;

export type TsumeShogiGenerationPlies =
  (typeof tsumeShogiGenerationPlies)[number];

/** 生成手順を変えて同じ identity から別の問題ができるようになったら上げる。 */
export const TSUME_SHOGI_GENERATOR_VERSION = "1";

/** 初手の合法な王手の数の範囲（両端を含む）。 */
export type TsumeShogiRootCheckRange = {
  minimum: number;
  maximum: number;
};

/**
 * 問題を作る条件。
 * - `plies`: 手数。
 * - `rootChecks`: 初手の合法な王手の数をこの範囲に絞る。難易度のレベルごとに候補の領域を寄せるために使う。省略すると絞らない。
 */
export type TsumeShogiGenerationConditions = {
  plies: TsumeShogiGenerationPlies;
  rootChecks?: TsumeShogiRootCheckRange;
};

/** 同じ問題を再現するための情報。 */
export type TsumeShogiProblemIdentity = {
  generatorVersion: typeof TSUME_SHOGI_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: TsumeShogiGenerationConditions;
};

/**
 * 記録に残した問題の識別情報。
 * 生成器の版が今と違う記録も読み戻せるよう、版と生成条件の形は今の生成器に限らない。
 * 今の生成器で扱えるかは `isTsumeShogiProblemIdentity` で確かめる。
 */
export type TsumeShogiRecordedProblemIdentity = {
  generatorVersion: string;
  seed: ProblemSeed;
  conditions: Readonly<Record<string, unknown>>;
};

/** 問題と、それを再現するための情報。 */
export type TsumeShogiIdentifiedProblem = {
  problem: TsumeShogiProblem;
  identity: TsumeShogiProblemIdentity;
};

/**
 * 問題を読み切る作業の量。速さの基準時間を問題ごとに決めるために使い、難易度そのものは表さない。
 * 値は生成時の難易度分析（`analyzeTsumeShogiDifficulty`）の特徴で、問題集に持たせる。
 * - `plies`: 手数。攻方が指す手の数は `(plies + 1) / 2`。
 * - `rootChecks`: 初手の合法な王手の数（読み始めの候補）。
 * - `plausibleWrong`: すべての判断地点の、もっともらしい誤王手（すぐには崩れない誤王手）の数の和。
 * - `deepDecoyCount`: すべての判断地点の、深い紛れ（反証が4手目以降まで見えない誤王手）の数の和。
 */
export type TsumeShogiSolveWorkload = {
  plies: number;
  rootChecks: number;
  plausibleWrong: number;
  deepDecoyCount: number;
};

/**
 * 生成条件と候補番号から identity を作る。seed は条件ごとに別の系列になるよう条件を含める。
 * 例: 5手・候補番号 3 は `ts-5-3`、5手・初手の王手 1〜4・候補番号 3 は `ts-5-c1-4-3`。
 */
export function createTsumeShogiProblemIdentity(
  plies: TsumeShogiGenerationPlies,
  candidateIndex: number,
  rootChecks?: TsumeShogiRootCheckRange,
): TsumeShogiProblemIdentity {
  return rootChecks === undefined
    ? {
        generatorVersion: TSUME_SHOGI_GENERATOR_VERSION,
        seed: `ts-${plies}-${candidateIndex}`,
        conditions: { plies },
      }
    : {
        generatorVersion: TSUME_SHOGI_GENERATOR_VERSION,
        seed: `ts-${plies}-c${rootChecks.minimum}-${rootChecks.maximum}-${candidateIndex}`,
        conditions: { plies, rootChecks: { ...rootChecks } },
      };
}

export function isTsumeShogiGenerationPlies(
  value: unknown,
): value is TsumeShogiGenerationPlies {
  return tsumeShogiGenerationPlies.some((plies) => plies === value);
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 記録など外部から読み戻した値が、現在の生成器で扱える識別情報かを確かめる。 */
export function isTsumeShogiProblemIdentity(
  value: unknown,
): value is TsumeShogiProblemIdentity {
  return (
    isRecordObject(value) &&
    isRecordObject(value.conditions) &&
    value.generatorVersion === TSUME_SHOGI_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    value.seed.length > 0 &&
    isTsumeShogiGenerationPlies(value.conditions.plies) &&
    (value.conditions.rootChecks === undefined ||
      isTsumeShogiRootCheckRange(value.conditions.rootChecks))
  );
}

/**
 * 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。
 * 今の生成器の版なら、今の生成器で扱える識別情報であることまで確かめる。
 */
export function isTsumeShogiRecordedProblemIdentity(
  value: unknown,
): value is TsumeShogiRecordedProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }

  const { generatorVersion, seed } = value;
  if (generatorVersion === TSUME_SHOGI_GENERATOR_VERSION) {
    return isTsumeShogiProblemIdentity(value);
  }
  return (
    typeof generatorVersion === "string" &&
    generatorVersion.length > 0 &&
    typeof seed === "string" &&
    seed.length > 0
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * 記録から読み戻した値が、作業の量として読めるかを確かめる。
 * 手数は正の奇数で、初手の王手は作意の初手があるので1以上。深い紛れはもっともらしい誤王手に含まれ、
 * もっともらしい誤王手は誤王手なので、どの判断地点でも王手の数より少ない（初手以外の判断地点の王手の数は持たないので、
 * 和どうしの大小までは確かめない）。生成器の版が今と違う記録も読めるよう、手数は今の生成器の範囲に限らない。
 */
export function isTsumeShogiSolveWorkload(
  value: unknown,
): value is TsumeShogiSolveWorkload {
  if (!isRecordObject(value)) {
    return false;
  }

  const { plies, rootChecks, plausibleWrong, deepDecoyCount } = value;
  return (
    isNonNegativeInteger(plies) &&
    plies % 2 === 1 &&
    isNonNegativeInteger(rootChecks) &&
    rootChecks >= 1 &&
    isNonNegativeInteger(plausibleWrong) &&
    isNonNegativeInteger(deepDecoyCount) &&
    deepDecoyCount <= plausibleWrong
  );
}

/** 作業の量が、識別情報の生成条件（手数と初手の王手の数の範囲）と食い違わないか。 */
export function isTsumeShogiWorkloadOfIdentity(
  workload: TsumeShogiSolveWorkload,
  identity: TsumeShogiProblemIdentity,
): boolean {
  const { plies, rootChecks } = identity.conditions;
  return (
    workload.plies === plies &&
    (rootChecks === undefined ||
      (rootChecks.minimum <= workload.rootChecks &&
        workload.rootChecks <= rootChecks.maximum))
  );
}

export function isTsumeShogiRootCheckRange(
  value: unknown,
): value is TsumeShogiRootCheckRange {
  return (
    isRecordObject(value) &&
    Number.isInteger(value.minimum) &&
    Number.isInteger(value.maximum) &&
    (value.minimum as number) >= 1 &&
    (value.minimum as number) <= (value.maximum as number)
  );
}

/**
 * 問題として遊べるかを確かめる。成り立たなければ `RangeError` を投げる。
 * 作意が合法で、攻方が毎手王手をかけ、作意の通りに `plies` 手で詰み、各攻方の手が残りの手数以内に詰む手であること。
 * 攻方の正解が一意かなどの品質は生成時の strict validator が確かめる。
 */
export function assertTsumeShogiProblem(problem: TsumeShogiProblem): void {
  const { initialPosition, plies, mainLine } = problem;
  if (!Number.isInteger(plies) || plies < 1 || plies % 2 === 0) {
    throw new RangeError(`手数は正の奇数にしてください: ${plies}`);
  }
  if (getTsumeShogiSideToMove(initialPosition) !== "attacker") {
    throw new RangeError("初期局面は攻方の手番にしてください");
  }
  if (mainLine.length !== plies) {
    throw new RangeError(
      `作意の長さが手数と違います: ${mainLine.length} / ${plies}`,
    );
  }
  let position = initialPosition;
  for (const [index, move] of mainLine.entries()) {
    if (!isTsumeShogiLegalMove(position, move)) {
      throw new RangeError(
        `作意の ${index + 1} 手目が合法手ではありません: ${formatTsumeShogiMoveUsi(move)}`,
      );
    }
    position = applyTsumeShogiMove(position, move);
    const isAttackerMove = index % 2 === 0;
    if (isAttackerMove && !isTsumeShogiDefenderInCheck(position)) {
      throw new RangeError(`作意の ${index + 1} 手目が王手ではありません`);
    }
    if (
      isAttackerMove &&
      !isTsumeShogiMateWithin(position, plies - index - 1)
    ) {
      throw new RangeError(
        `作意の ${index + 1} 手目の後、残りの手数以内に詰みません`,
      );
    }
  }
  if (!isTsumeShogiCheckmate(position)) {
    throw new RangeError("作意の最後で詰んでいません");
  }
}

export function formatTsumeShogiProblemText(
  problem: TsumeShogiProblem,
): TsumeShogiProblemText {
  return {
    sfen: formatTsumeShogiPosition(problem.initialPosition),
    mainLine: problem.mainLine.map(formatTsumeShogiMoveUsi),
  };
}

/** 文字列の形から問題を読む。局面・着手として読めなければ `RangeError` を投げる。問題として成り立つかは見ない。 */
export function parseTsumeShogiProblemText(
  text: TsumeShogiProblemText,
): TsumeShogiProblem {
  return {
    initialPosition: parseTsumeShogiPosition(text.sfen),
    plies: text.mainLine.length,
    mainLine: text.mainLine.map(parseTsumeShogiMoveUsi),
  };
}
