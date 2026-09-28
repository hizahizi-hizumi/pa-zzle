import { analyzeReflectionDifficulty } from "@/games/reflection/problem/difficulty-analysis";
import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  createEmptyReflectionInventory,
  parseReflectionBoard,
  type ReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";

function toProblem(board: ReflectionBoard): ReflectionProblem {
  return {
    size: board.size,
    inventory: countReflectionBoardPieces(board),
    clues: computeReflectionClues(board),
    solution: board,
  };
}

describe("analyzeReflectionDifficulty", () => {
  describe("一意解の問題", () => {
    const problem = toProblem(
      parseReflectionBoard([".....", ".....", "o...o", "=....", "....."]),
    );

    test("規模と推論の特徴を返すこと", () => {
      const result = analyzeReflectionDifficulty(problem);

      expect(result).toEqual({
        status: "analyzed",
        scale: {
          size: 5,
          cellCount: 25,
          clueCount: 20,
          pieceCount: 3,
          pieceKindCount: 2,
        },
        features: {
          highestLevel: 2,
          fixedPieceCountByLevel: [2, 1, 0, 0, 0],
          propagationRoundCount: 1,
          assumptionTestCount: 0,
          assumptionEliminationCount: 0,
        },
      });
    });
  });

  describe("外周ヒントが同じ配置が2つある問題", () => {
    // 2つ目の斜め鏡を2行4列と3行3列のどちらに置いても、全外周ヒントが同じになる。
    const problem = toProblem(
      parseReflectionBoard(["/....", ".../.", ".....", ".....", "....."]),
    );

    test("成立しない問題とすること", () => {
      const result = analyzeReflectionDifficulty(problem);

      expect(result).toMatchObject({
        status: "invalid",
        reason: "multiple-solutions",
      });
    });
  });

  describe("手持ちと外周ヒントに合う配置が無い問題", () => {
    const problem: ReflectionProblem = {
      ...toProblem(
        parseReflectionBoard([".....", ".....", ".....", ".....", "....."]),
      ),
      inventory: { ...createEmptyReflectionInventory(), "black-hole": 1 },
    };

    test("成立しない問題とすること", () => {
      const result = analyzeReflectionDifficulty(problem);

      expect(result).toMatchObject({
        status: "invalid",
        reason: "no-solution",
      });
    });
  });
});
