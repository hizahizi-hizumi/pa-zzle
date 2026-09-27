import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";

/**
 * 問題集から出題できるようになるまで、全難易度で出題する 8×8 の固定問題。
 * 一意解で、1本の行・列だけを読む推論で推測なしに解き切れる。
 */
export const takuzuFixedProblem: TakuzuProblem = {
  givens: parseTakuzuBoard([
    "A...AAB.",
    "..ABA.B.",
    "B.......",
    "........",
    ".B..A.AB",
    "...AB.B.",
    ".B...A..",
    "..A....A",
  ]),
  solution: parseTakuzuBoard([
    "AABBAABB",
    "BAABABBA",
    "BBAABBAA",
    "AABABABB",
    "ABABABAB",
    "BABABABA",
    "ABBABAAB",
    "BBABABAA",
  ]),
};
