import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";
import { listFukumenzanLetters } from "@/games/fukumenzan/puzzle/equation";
import { isPositiveInteger, isRecordObject } from "@/lib/type-guards";

/**
 * 1問を解く作業の量。採点の基準時間に使う。
 * - `letterCount`: 数字を決めて札を入れる文字の数。
 * - `letterCellCount`: 式に書かれた文字の数（同じ文字も別に数える）。桁を見比べて足し算を読む量。
 */
export type FukumenzanWorkload = {
  letterCount: number;
  letterCellCount: number;
};

export function measureFukumenzanWorkload(
  problem: FukumenzanProblem,
): FukumenzanWorkload {
  return {
    letterCount: listFukumenzanLetters(problem).length,
    letterCellCount: [...problem.addends, problem.result].join("").length,
  };
}

/** 記録から読み戻した値を確かめる。式の文字は同じ文字を含めて数えるので、文字の種類より少なくならない。 */
export function isFukumenzanWorkload(
  value: unknown,
): value is FukumenzanWorkload {
  return (
    isRecordObject(value) &&
    isPositiveInteger(value.letterCount) &&
    isPositiveInteger(value.letterCellCount) &&
    value.letterCount <= value.letterCellCount
  );
}
