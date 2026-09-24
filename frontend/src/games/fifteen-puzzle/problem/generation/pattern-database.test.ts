// @vitest-environment node

import {
  buildFifteenPuzzlePatternDatabase,
  createFifteenPuzzlePatternDatabaseHeuristic,
} from "@/games/fifteen-puzzle/problem/generation/pattern-database";
import { solveFifteenPuzzleOptimally } from "@/games/fifteen-puzzle/problem/generation/solver";
import { generateFifteenPuzzleBoard } from "@/games/fifteen-puzzle/problem/generator";

describe("createFifteenPuzzlePatternDatabaseHeuristic", () => {
  // テストでは小さな集合だけを使い、構築を一瞬で終わらせる。
  const database = buildFifteenPuzzlePatternDatabase([[1, 2], [5, 6], [3]]);
  const boards = [
    ["pdb-1", 18],
    ["pdb-2", 24],
    ["pdb-3", 30],
  ] as const;
  const cases = boards.map(([seed, scrambleLength]) => {
    const board = generateFifteenPuzzleBoard(seed, { size: 4, scrambleLength });
    const solved = solveFifteenPuzzleOptimally(board);
    return [
      seed,
      board,
      solved.status === "solved" ? solved.optimalMoveCount : null,
    ] as const;
  });

  test.each(cases)(
    "線形衝突の下界と同じ最短手数を求めること: %s",
    (_seed, board, optimalMoveCount) => {
      const result = solveFifteenPuzzleOptimally(board, {
        heuristic: createFifteenPuzzlePatternDatabaseHeuristic(database),
      });

      expect(result).toMatchObject({ status: "solved", optimalMoveCount });
    },
  );

  test.each(cases)(
    "盤面全体の下界が最短手数を超えないこと: %s",
    (_seed, board, optimalMoveCount) => {
      const estimate = createFifteenPuzzlePatternDatabaseHeuristic(
        database,
      ).reset(Uint8Array.from(board));

      expect(estimate).toBeLessThanOrEqual(optimalMoveCount ?? 0);
    },
  );
});

describe("buildFifteenPuzzlePatternDatabase", () => {
  const overlappingPatterns = [
    [1, 2],
    [2, 3],
  ];

  test("タイルが重なる集合を拒否すること", () => {
    const act = () => buildFifteenPuzzlePatternDatabase(overlappingPatterns);

    expect(act).toThrow(RangeError);
  });
});
