import {
  assertFukumenzanEquation,
  type FukumenzanEquation,
} from "@/games/fukumenzan/puzzle/equation";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import { isRecordObject } from "@/lib/type-guards";

/**
 * 1問を遊ぶためのデータ。式だけを持ち、解は持たない。
 * クリアは規則で判定し（`isFukumenzanSolved`）、問題は一意解なので解との照合は要らない。
 */
export type FukumenzanProblem = FukumenzanEquation;

/** 問題に使う文字。数字の 1・0・0・5・2 と見間違えやすい I・O・Q・S・Z を除く。 */
export const FUKUMENZAN_PROBLEM_LETTERS = "ABCDEFGHJKLMNPRTUVWXY";

/** identity の形を変えたら上げる。式の文字列だけで問題が決まるので、生成の手順を変えても同じ式は同じ問題になる。 */
export const FUKUMENZAN_GENERATOR_VERSION = "1";

/** 候補を作る条件。足す数の桁の数を上から並べる。 */
export type FukumenzanGenerationConditions = {
  addendLengths: readonly number[];
};

/**
 * 同じ問題を再現するための情報。`seed` は式の文字列（例 `BYK+KTK=TKHH`）で、それだけで問題が決まる。
 */
export type FukumenzanProblemIdentity = {
  generatorVersion: typeof FUKUMENZAN_GENERATOR_VERSION;
  seed: string;
  conditions: FukumenzanGenerationConditions;
};

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も読み込む。 */
export type FukumenzanRecordedProblemIdentity = RecordedProblemIdentity;

export type FukumenzanIdentifiedProblem = {
  problem: FukumenzanProblem;
  identity: FukumenzanProblemIdentity;
};

export function formatFukumenzanEquation({
  addends,
  result,
}: FukumenzanEquation): string {
  return `${addends.join("+")}=${result}`;
}

/** 形が読めない文字列には `null` を返す。盤面に描けるかは `assertFukumenzanProblem` で確かめる。 */
export function parseFukumenzanEquation(
  text: string,
): FukumenzanEquation | null {
  const match = /^([A-Z]+(?:\+[A-Z]+)+)=([A-Z]+)$/.exec(text);
  if (!match) {
    return null;
  }
  return { addends: match[1]!.split("+"), result: match[2]! };
}

export function createFukumenzanProblemIdentity(
  problem: FukumenzanProblem,
): FukumenzanProblemIdentity {
  return {
    generatorVersion: FUKUMENZAN_GENERATOR_VERSION,
    seed: formatFukumenzanEquation(problem),
    conditions: {
      addendLengths: problem.addends.map((addend) => addend.length),
    },
  };
}

export function assertFukumenzanProblem(problem: FukumenzanProblem): void {
  assertFukumenzanEquation(problem);
  const usesOnlyProblemLetters = [...problem.addends, problem.result].every(
    (word) =>
      [...word].every((letter) => FUKUMENZAN_PROBLEM_LETTERS.includes(letter)),
  );
  if (!usesOnlyProblemLetters) {
    throw new RangeError(
      `Fukumenzan problem must use only ${FUKUMENZAN_PROBLEM_LETTERS}`,
    );
  }
}

function isValidProblem(problem: FukumenzanProblem): boolean {
  try {
    assertFukumenzanProblem(problem);
    return true;
  } catch {
    return false;
  }
}

/** 記録など外部から読み戻した値を確かめる。条件は式の文字列から求めたものと一致しなければならない。 */
export function isCurrentFukumenzanProblemIdentity(
  value: unknown,
): value is FukumenzanProblemIdentity {
  if (
    !isRecordObject(value) ||
    value.generatorVersion !== FUKUMENZAN_GENERATOR_VERSION ||
    typeof value.seed !== "string" ||
    !isRecordObject(value.conditions)
  ) {
    return false;
  }
  const problem = parseFukumenzanEquation(value.seed);
  if (problem === null || !isValidProblem(problem)) {
    return false;
  }
  const { addendLengths } = value.conditions;
  const expectedLengths =
    createFukumenzanProblemIdentity(problem).conditions.addendLengths;
  return (
    Array.isArray(addendLengths) &&
    addendLengths.length === expectedLengths.length &&
    addendLengths.every((length, index) => length === expectedLengths[index])
  );
}

export function isFukumenzanRecordedProblemIdentity(
  value: unknown,
): value is FukumenzanRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: FUKUMENZAN_GENERATOR_VERSION,
    isProblemIdentity: isCurrentFukumenzanProblemIdentity,
  });
}
