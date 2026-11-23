import { magicSquareExampleSquares } from "@/games/magic-square/problem/example-squares";
import type { MagicSquareGrid } from "@/games/magic-square/problem/generation/solver";
import {
  canonicalizeMagicSquareGrid,
  createMagicSquareProblemKeys,
  isSameMagicSquareKey,
  type MagicSquareProblemKeys,
  measureMagicSquareNearDistance,
} from "@/games/magic-square/problem/generation/symmetry";

/**
 * 答えが同じ類で、与える数のある所の違い（近さ）がこの値以下の問題は、先に採った問題と似すぎとして採らない。
 * 近さ 2 は与える数を1つ動かしただけの問題。6 以下まで避けると、4×4 で採れる問題が尽きかける（供給実験）。
 */
export const MAGIC_SQUARE_NEAR_DISTANCE_LIMIT = 4;

/** 問題集に採るかを決める1問。答えを持つのは、採るかを決める間だけ。 */
export type MagicSquarePoolCandidate = {
  givens: MagicSquareGrid;
  solution: MagicSquareGrid;
  keys: MagicSquareProblemKeys;
};

export function createMagicSquarePoolCandidate(
  givens: MagicSquareGrid,
  solution: MagicSquareGrid,
): MagicSquarePoolCandidate {
  return {
    givens,
    solution,
    keys: createMagicSquareProblemKeys(givens, solution),
  };
}

let exampleSolutionKeys: readonly (readonly number[])[] | null = null;

/** 例の魔方陣の答えのキー（G × 補数）。例の魔方陣をそれぞれ G × 補数で写した64通りを、1つのキーで表す。 */
export function listMagicSquareExampleSolutionKeys(): readonly (readonly number[])[] {
  if (exampleSolutionKeys === null) {
    exampleSolutionKeys = Object.values(magicSquareExampleSquares).map(
      (square) => canonicalizeMagicSquareGrid(square, "G", true),
    );
  }
  return exampleSolutionKeys;
}

/** 答えが例の魔方陣と同じ類か。 */
export function isMagicSquareExampleAnswer(solution: MagicSquareGrid): boolean {
  const key = canonicalizeMagicSquareGrid(solution, "G", true);
  return listMagicSquareExampleSolutionKeys().some((exampleKey) =>
    isSameMagicSquareKey(exampleKey, key),
  );
}

/**
 * 採否。上から当てる。
 * - `example`: 答えが例の魔方陣と同じ類。
 * - `duplicate`: 問題のキー（G × 補数）が、先に採った問題と同じ。
 * - `same-answer-d4`: 4×4 で、答えを回転・裏返しで同じとみなすと、先に採った問題と同じ。4×4 の答えは回転・裏返しを除くと
 *   880 通りしかないので、同じ答えを2度使わない。
 * - `near`: 答えが同じ類の先に採った問題との近さが `MAGIC_SQUARE_NEAR_DISTANCE_LIMIT` 以下。
 *
 * `partner` は当たった先に採った問題の、`accepted` での位置。
 */
export type MagicSquarePoolDecision =
  | { kind: "accept" }
  | { kind: "example" }
  | { kind: "duplicate"; partner: number }
  | { kind: "same-answer-d4"; partner: number }
  | { kind: "near"; partner: number; distance: number };

/** 先に採った問題 `accepted` に、`candidate` を加えてよいか。レベルと盤面の件数は、問題集を組み立てる側で決める。 */
export function judgeMagicSquarePoolCandidate(
  candidate: MagicSquarePoolCandidate,
  accepted: readonly MagicSquarePoolCandidate[],
): MagicSquarePoolDecision {
  const { keys } = candidate;
  if (isMagicSquareExampleAnswer(candidate.solution)) {
    return { kind: "example" };
  }
  const duplicate = accepted.findIndex((other) =>
    isSameMagicSquareKey(other.keys.problem, keys.problem),
  );
  if (duplicate >= 0) {
    return { kind: "duplicate", partner: duplicate };
  }
  if (candidate.solution.length === 16) {
    const sameAnswer = accepted.findIndex(
      (other) =>
        other.solution.length === 16 &&
        isSameMagicSquareKey(other.keys.solutionD4, keys.solutionD4),
    );
    if (sameAnswer >= 0) {
      return { kind: "same-answer-d4", partner: sameAnswer };
    }
  }
  for (const [partner, other] of accepted.entries()) {
    if (!isSameMagicSquareKey(other.keys.solution, keys.solution)) {
      continue;
    }
    const distance = measureMagicSquareNearDistance(other, candidate);
    if (distance !== null && distance <= MAGIC_SQUARE_NEAR_DISTANCE_LIMIT) {
      return { kind: "near", partner, distance };
    }
  }
  return { kind: "accept" };
}
