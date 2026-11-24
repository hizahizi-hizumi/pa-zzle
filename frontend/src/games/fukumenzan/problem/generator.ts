import { countFukumenzanSolutions } from "@/games/fukumenzan/problem/generation/exact-solver";
import {
  createFukumenzanProblemIdentity,
  FUKUMENZAN_PROBLEM_LETTERS,
  type FukumenzanIdentifiedProblem,
} from "@/games/fukumenzan/problem/problem";
import {
  type ProblemRandom,
  pickProblemValue,
  shuffleProblemValues,
} from "@/games/problem-seed";

/** 候補を作る条件。足す数の桁の数（上から）と、式に使う文字の数。 */
export type FukumenzanCandidateConditions = {
  addendLengths: readonly number[];
  letterCount: number;
};

/**
 * 生成器が返す一意解の問題。
 * - `solution`: 文字ごと（式に初めて出た順）の数字。問題集の検証と分析に使い、プレイには渡さない。
 * - `regenerationCount`: 解が1つでなく作り直した回数。
 */
export type FukumenzanGeneratedProblem = FukumenzanIdentifiedProblem & {
  solution: readonly number[];
  regenerationCount: number;
};

/** 数字の組から、全部の数字を使う式を作る試しの上限。 */
const MAXIMUM_EQUATION_ATTEMPTS = 4000;

/** 一意解の式になるまで作り直す上限。 */
const MAXIMUM_REGENERATIONS = 400;

const digits = Array.from({ length: 10 }, (_, digit) => digit);

/**
 * 使う数字の組を先に選び、その数字だけで足す数を作って、足した答えまでで組の全部の数字を使う式を探す。
 * 数字を無作為な文字に置き換えて式にする。
 */
function generateEquation(
  { addendLengths, letterCount }: FukumenzanCandidateConditions,
  random: ProblemRandom,
): { addends: string[]; result: string } | null {
  for (let attempt = 0; attempt < MAXIMUM_EQUATION_ATTEMPTS; attempt += 1) {
    const usedDigits = shuffleProblemValues(digits, random).slice(
      0,
      letterCount,
    );
    const nonzeroDigits = usedDigits.filter((digit) => digit !== 0);
    if (nonzeroDigits.length === 0) {
      continue;
    }
    const numbers = addendLengths.map((length) =>
      [
        pickProblemValue(nonzeroDigits, random),
        ...Array.from({ length: length - 1 }, () =>
          pickProblemValue(usedDigits, random),
        ),
      ].join(""),
    );
    const sum = String(
      numbers.reduce((total, number) => total + Number(number), 0),
    );
    const appearing = new Set([...[...numbers, sum].join("")].map(Number));
    if (
      appearing.size !== usedDigits.length ||
      usedDigits.some((digit) => !appearing.has(digit))
    ) {
      continue;
    }
    const letters = shuffleProblemValues(
      [...FUKUMENZAN_PROBLEM_LETTERS],
      random,
    ).slice(0, letterCount);
    const letterOfDigit = new Map(
      usedDigits.map((digit, index) => [String(digit), letters[index]!]),
    );
    function toWord(number: string): string {
      return [...number].map((digit) => letterOfDigit.get(digit)!).join("");
    }
    return { addends: numbers.map(toWord), result: toWord(sum) };
  }
  return null;
}

/**
 * 一意解の問題を1つ作る。解が1つでなければ、同じ条件（文字の数を含む）で作り直す。上限までに作れなければ `null`。
 * 難易度は問題集の生成で分析・分類して決める。
 */
export function generateFukumenzanProblem(
  conditions: FukumenzanCandidateConditions,
  random: ProblemRandom,
): FukumenzanGeneratedProblem | null {
  for (
    let regenerationCount = 0;
    regenerationCount < MAXIMUM_REGENERATIONS;
    regenerationCount += 1
  ) {
    const problem = generateEquation(conditions, random);
    if (problem === null) {
      return null;
    }
    const { count, firstSolution } = countFukumenzanSolutions(problem, 2);
    if (count === 1) {
      return {
        problem,
        identity: createFukumenzanProblemIdentity(problem),
        solution: firstSolution!,
        regenerationCount,
      };
    }
  }
  return null;
}
