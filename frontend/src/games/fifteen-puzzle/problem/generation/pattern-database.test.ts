// @vitest-environment node

import {
  buildFifteenPuzzlePatternDatabase,
  createFifteenPuzzlePatternDatabaseHeuristic,
} from "@/games/fifteen-puzzle/problem/generation/pattern-database";
import { solveFifteenPuzzleOptimally } from "@/games/fifteen-puzzle/problem/generation/solver";
import { generateFifteenPuzzleBoard } from "@/games/fifteen-puzzle/problem/generator";
import {
  applyFifteenPuzzleSlide,
  getFifteenPuzzleSlide,
  listFifteenPuzzleSingleMoves,
} from "@/games/fifteen-puzzle/puzzle/rules";
import {
  createSolvedFifteenPuzzleBoard,
  type FifteenPuzzleBoard,
} from "@/games/fifteen-puzzle/puzzle/state";

function listBoardsWithinDistanceFromSolved(
  maxDistance: number,
): readonly (readonly [FifteenPuzzleBoard, number])[] {
  const solvedBoard = createSolvedFifteenPuzzleBoard();
  const visited = new Set([solvedBoard.join(",")]);
  const entries: (readonly [FifteenPuzzleBoard, number])[] = [[solvedBoard, 0]];
  for (const [board, distance] of entries) {
    if (distance === maxDistance) {
      continue;
    }
    for (const tileIndex of listFifteenPuzzleSingleMoves(board)) {
      const slide = getFifteenPuzzleSlide(board, tileIndex);
      const nextBoard = slide ? applyFifteenPuzzleSlide(board, slide) : board;
      const key = nextBoard.join(",");
      if (!visited.has(key)) {
        visited.add(key);
        entries.push([nextBoard, distance + 1]);
      }
    }
  }
  return entries;
}

describe("createFifteenPuzzlePatternDatabaseHeuristic", () => {
  // テストでは小さな集合だけを使い、構築を一瞬で終わらせる。
  const database = buildFifteenPuzzlePatternDatabase([[1, 2], [5, 6], [3]]);
  const heuristic = createFifteenPuzzlePatternDatabaseHeuristic(database);
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
      const result = solveFifteenPuzzleOptimally(board, { heuristic });

      expect(result).toMatchObject({ status: "solved", optimalMoveCount });
    },
  );

  test.each(cases)(
    "盤面全体の下界が最短手数を超えないこと: %s",
    (_seed, board, optimalMoveCount) => {
      const estimate = heuristic.reset(Uint8Array.from(board));

      expect(estimate).toBeLessThanOrEqual(optimalMoveCount ?? 0);
    },
  );

  describe("3 枚ずつの集合の場合", () => {
    const threeTileHeuristic = createFifteenPuzzlePatternDatabaseHeuristic(
      buildFifteenPuzzlePatternDatabase([
        [1, 2, 3],
        [5, 6, 9],
        [4, 7, 8],
      ]),
    );
    const boardsWithinDistance = listBoardsWithinDistanceFromSolved(12);

    test("完成盤面から 12 手以内の全盤面で、下界が完成までの最短手数を超えないこと", () => {
      const overestimated = boardsWithinDistance.filter(
        ([board, distance]) =>
          threeTileHeuristic.reset(Uint8Array.from(board)) > distance,
      );

      expect(overestimated).toEqual([]);
    });
  });
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

  const oversizedPatterns = [[1, 2, 3, 4, 5, 6]];

  test("6 枚以上の集合を拒否すること", () => {
    const act = () => buildFifteenPuzzlePatternDatabase(oversizedPatterns);

    expect(act).toThrow(RangeError);
  });
});
