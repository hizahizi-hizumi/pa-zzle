import {
  createFukumenzanColumnModel,
  type FukumenzanColumnModel,
} from "@/games/fukumenzan/problem/generation/column-model";
import type { FukumenzanEquation } from "@/games/fukumenzan/puzzle/equation";

/**
 * 解の数を `limit` まで数えた結果。`firstSolution` は見つけた最初の解の、文字ごと（式に初めて出た順）の数字。
 */
export type FukumenzanSolutionCount = {
  count: number;
  firstSolution: readonly number[] | null;
};

/**
 * 一の位の桁から、繰り上がりを持ち回りながら、足す側のまだ決まっていない文字に違う数字を当てる完全な探索。
 * 桁の足す側が埋まったら、答えの文字は和から決まる。
 */
export function countFukumenzanSolutions(
  equation: FukumenzanEquation,
  limit: number,
): FukumenzanSolutionCount {
  return countModelSolutions(createFukumenzanColumnModel(equation), limit);
}

function countModelSolutions(
  model: FukumenzanColumnModel,
  limit: number,
): FukumenzanSolutionCount {
  const { columns, columnCount, leadingLetters } = model;
  const assigned = Array.from({ length: model.letterCount }, () => -1);
  const used = Array.from({ length: 10 }, () => false);
  let count = 0;
  let firstSolution: number[] | null = null;

  function startColumn(column: number, carry: number): boolean {
    if (column === columnCount) {
      if (carry !== 0) {
        return false;
      }
      count += 1;
      firstSolution ??= [...assigned];
      return count >= limit;
    }
    return fillTerm(column, carry, 0);
  }

  function fillTerm(column: number, carry: number, termIndex: number): boolean {
    const { terms, resultVariable } = columns[column]!;
    const term = terms[termIndex];
    if (term !== undefined) {
      if (assigned[term.variable]! >= 0) {
        return fillTerm(column, carry, termIndex + 1);
      }
      for (let digit = 0; digit < 10; digit += 1) {
        if (used[digit] || (digit === 0 && leadingLetters.has(term.variable))) {
          continue;
        }
        assigned[term.variable] = digit;
        used[digit] = true;
        if (fillTerm(column, carry, termIndex + 1)) {
          return true;
        }
        used[digit] = false;
        assigned[term.variable] = -1;
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
        assigned[resultVariable] === digit && startColumn(column + 1, carryOut)
      );
    }
    if (used[digit] || (digit === 0 && leadingLetters.has(resultVariable))) {
      return false;
    }
    assigned[resultVariable] = digit;
    used[digit] = true;
    if (startColumn(column + 1, carryOut)) {
      return true;
    }
    used[digit] = false;
    assigned[resultVariable] = -1;
    return false;
  }

  startColumn(0, 0);
  return { count, firstSolution };
}
