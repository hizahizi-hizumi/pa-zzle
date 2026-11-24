import { createFukumenzanColumnModel } from "@/games/fukumenzan/problem/generation/column-model";
import type { FukumenzanEquation } from "@/games/fukumenzan/puzzle/equation";
import { type ProblemRandom, shuffleProblemValues } from "@/games/problem-seed";

/**
 * 素朴な解き方を1回試した結果。`placementCount` は試し置きと答えの書き込みの合計。上限を超えたら `solved` は偽。
 */
export type FukumenzanNaiveTrial = {
  solved: boolean;
  placementCount: number;
  backtrackCount: number;
};

/**
 * 読まずに、試し置きと盤面の知らせ（先頭の0・右から埋まった桁の計算違い）で押し切る解き方。
 * 一の位の桁から、足す側の文字にまだ札の残っている数字（先頭の文字は0以外）を無作為な順で置き、桁の足す側が埋まったら答えの
 * 文字を計算して置く。計算した数字の札が残っていないか、先頭が0になるか、答えの文字にすでに別の数字があれば、その桁の最後の
 * 試し置きを戻して次を試す。答えを当てずに計算で置くので、知らせを待って当て直すより置く数は少ないか同じになる。
 */
export function tryFukumenzanNaively(
  equation: FukumenzanEquation,
  random: ProblemRandom,
  placementLimit: number,
): FukumenzanNaiveTrial {
  const model = createFukumenzanColumnModel(equation);
  const { columns, columnCount, leadingLetters } = model;
  const assigned = Array.from({ length: model.letterCount }, () => -1);
  const used = Array.from({ length: 10 }, () => false);
  let placementCount = 0;
  let backtrackCount = 0;
  let stopped = false;

  function place(): boolean {
    placementCount += 1;
    if (placementCount > placementLimit) {
      stopped = true;
      return false;
    }
    return true;
  }

  function fillColumn(
    column: number,
    carry: number,
    termIndex: number,
  ): boolean {
    if (stopped) {
      return false;
    }
    if (column === columnCount) {
      return carry === 0;
    }
    const { terms, resultVariable } = columns[column]!;
    const term = terms[termIndex];
    if (term !== undefined) {
      if (assigned[term.variable]! >= 0) {
        return fillColumn(column, carry, termIndex + 1);
      }
      const candidates = shuffleProblemValues(
        Array.from({ length: 10 }, (_, digit) => digit).filter(
          (digit) =>
            !used[digit] && !(digit === 0 && leadingLetters.has(term.variable)),
        ),
        random,
      );
      for (const digit of candidates) {
        if (!place()) {
          return false;
        }
        assigned[term.variable] = digit;
        used[digit] = true;
        if (fillColumn(column, carry, termIndex + 1)) {
          return true;
        }
        used[digit] = false;
        assigned[term.variable] = -1;
        backtrackCount += 1;
        if (stopped) {
          return false;
        }
      }
      return false;
    }
    let sum = carry;
    for (const { variable, multiplicity } of terms) {
      sum += multiplicity * assigned[variable]!;
    }
    const digit = sum % 10;
    const carryOut = Math.floor(sum / 10);
    if (assigned[resultVariable]! >= 0) {
      return (
        assigned[resultVariable] === digit &&
        fillColumn(column + 1, carryOut, 0)
      );
    }
    if (used[digit] || (digit === 0 && leadingLetters.has(resultVariable))) {
      return false;
    }
    if (!place()) {
      return false;
    }
    assigned[resultVariable] = digit;
    used[digit] = true;
    if (fillColumn(column + 1, carryOut, 0)) {
      return true;
    }
    used[digit] = false;
    assigned[resultVariable] = -1;
    backtrackCount += 1;
    return false;
  }

  const solved = fillColumn(0, 0, 0);
  return { solved, placementCount, backtrackCount };
}
