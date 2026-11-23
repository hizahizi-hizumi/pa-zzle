import {
  countMagicSquareSolutions,
  type MagicSquareGrid,
} from "@/games/magic-square/problem/generation/solver";
import { type ProblemRandom, pickProblemValue } from "@/games/problem-seed";

/** 乱択の魔方陣を1回探すときの節点の上限。打ち切ったら、別の並びで探し直す。 */
export const MAGIC_SQUARE_RANDOM_SEARCH_NODE_CAP = 200_000;

let allSquares4: readonly MagicSquareGrid[] | null = null;

/** 4×4 の魔方陣の全部（7,040 通り）。空の盤面を解法器で数え上げた順に並ぶ。 */
export function listAllMagicSquares4(): readonly MagicSquareGrid[] {
  if (allSquares4 === null) {
    allSquares4 = countMagicSquareSolutions(4, Array(16).fill(0), {
      limit: Number.POSITIVE_INFINITY,
      nodeCap: null,
      collect: true,
    }).solutions;
  }
  return allSquares4;
}

/** 4×4 の答えは、全部の魔方陣から一様に選ぶ。乱択の探索では、見つけやすい魔方陣に偏るため。 */
export function pickMagicSquare4(random: ProblemRandom): MagicSquareGrid {
  return pickProblemValue(listAllMagicSquares4(), random);
}

/**
 * 5×5・6×6 の答えを、入れる数の順を乱数で並べ替えた深さ優先の探索で1つ作る。
 * 節点の上限で打ち切ったら探し直す。`nodes` は、探し直しを含めて調べた節点の合計。
 */
export function createRandomMagicSquare(
  size: number,
  random: ProblemRandom,
  nodeCap: number = MAGIC_SQUARE_RANDOM_SEARCH_NODE_CAP,
): { square: MagicSquareGrid; nodes: number } {
  let nodes = 0;
  for (;;) {
    const result = countMagicSquareSolutions(size, Array(size * size).fill(0), {
      limit: 1,
      nodeCap,
      random,
      collect: true,
    });
    nodes += result.nodes;
    const [square] = result.solutions;
    if (square) {
      return { square, nodes };
    }
  }
}
