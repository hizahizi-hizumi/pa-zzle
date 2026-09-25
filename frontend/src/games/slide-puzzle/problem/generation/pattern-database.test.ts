// @vitest-environment node

import { buildSlidePuzzleAllStateDistances } from "@/games/slide-puzzle/problem/generation/all-state-distances";
import {
  buildSlidePuzzlePatternDatabase,
  createSlidePuzzlePatternDatabaseHeuristic,
} from "@/games/slide-puzzle/problem/generation/pattern-database";
import { solveSlidePuzzleOptimally } from "@/games/slide-puzzle/problem/generation/solver";
import { generateSlidePuzzleBoard } from "@/games/slide-puzzle/problem/generator";
import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  listSlidePuzzleSingleMoves,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  createSolvedSlidePuzzleBoard,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";

function listBoardsWithinDistanceFromSolved(
  boardSize: SlidePuzzleBoardSize,
  maxDistance: number,
): readonly (readonly [SlidePuzzleBoard, number])[] {
  const solvedBoard = createSolvedSlidePuzzleBoard(boardSize);
  const visited = new Set([solvedBoard.join(",")]);
  const entries: (readonly [SlidePuzzleBoard, number])[] = [[solvedBoard, 0]];
  for (const [board, distance] of entries) {
    if (distance === maxDistance) {
      continue;
    }
    for (const tileIndex of listSlidePuzzleSingleMoves(board)) {
      const slide = getSlidePuzzleSlide(board, tileIndex);
      const nextBoard = slide ? applySlidePuzzleSlide(board, slide) : board;
      const key = nextBoard.join(",");
      if (!visited.has(key)) {
        visited.add(key);
        entries.push([nextBoard, distance + 1]);
      }
    }
  }
  return entries;
}

describe("createSlidePuzzlePatternDatabaseHeuristic", () => {
  // テストでは小さな集合だけを使い、構築を一瞬で終わらせる。
  const database = buildSlidePuzzlePatternDatabase(4, [[1, 2], [5, 6], [3]]);
  const heuristic = createSlidePuzzlePatternDatabaseHeuristic(database);
  const boards = [
    ["pdb-1", 18],
    ["pdb-2", 24],
    ["pdb-3", 30],
  ] as const;
  const cases = boards.map(([seed, scrambleLength]) => {
    const board = generateSlidePuzzleBoard(seed, { size: 4, scrambleLength });
    const solved = solveSlidePuzzleOptimally(board);
    return [
      seed,
      board,
      solved.status === "solved" ? solved.optimalMoveCount : null,
    ] as const;
  });

  test.each(cases)(
    "線形衝突の下界と同じ最短手数を求めること: %s",
    (_seed, board, optimalMoveCount) => {
      const result = solveSlidePuzzleOptimally(board, { heuristic });

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
    const threeTileHeuristic = createSlidePuzzlePatternDatabaseHeuristic(
      buildSlidePuzzlePatternDatabase(4, [
        [1, 2, 3],
        [5, 6, 9],
        [4, 7, 8],
      ]),
    );
    const boardsWithinDistance = listBoardsWithinDistanceFromSolved(4, 12);

    test("完成盤面から 12 手以内の全盤面で、下界が完成までの最短手数を超えないこと", () => {
      const overestimated = boardsWithinDistance.filter(
        ([board, distance]) =>
          threeTileHeuristic.reset(Uint8Array.from(board)) > distance,
      );

      expect(overestimated).toEqual([]);
    });
  });
});

describe("3×3 の既定の分割の場合", () => {
  const heuristic = createSlidePuzzlePatternDatabaseHeuristic(
    buildSlidePuzzlePatternDatabase(3),
  );
  const allStateDistances = buildSlidePuzzleAllStateDistances();
  const cases = [
    ["pdb3-1", 20],
    ["pdb3-2", 45],
    ["pdb3-3", 100],
  ] as const;
  const boards = cases.map(
    ([seed, scrambleLength]) =>
      [
        seed,
        generateSlidePuzzleBoard(seed, { size: 3, scrambleLength }),
      ] as const,
  );

  test.each(boards)(
    "全状態の幅優先探索と同じ最短手数を求めること: %s",
    (_seed, board) => {
      const result = solveSlidePuzzleOptimally(board, { heuristic });

      expect(result).toMatchObject({
        status: "solved",
        optimalMoveCount: allStateDistances.distanceOf(board),
      });
    },
  );
});

describe("5×5 の小さな集合の場合", () => {
  // 5×5 の既定の分割は構築に数分かかるので、テストでは 2 枚と 1 枚の集合で性質だけを確かめる。
  const heuristic = createSlidePuzzlePatternDatabaseHeuristic(
    buildSlidePuzzlePatternDatabase(5, [[1, 2], [7]]),
  );
  const boardsWithinDistance = listBoardsWithinDistanceFromSolved(5, 10);

  test("完成盤面から 10 手以内の全盤面で、下界が完成までの最短手数を超えないこと", () => {
    const overestimated = boardsWithinDistance.filter(
      ([board, distance]) => heuristic.reset(Uint8Array.from(board)) > distance,
    );

    expect(overestimated).toEqual([]);
  });
});

describe("buildSlidePuzzlePatternDatabase", () => {
  const overlappingPatterns = [
    [1, 2],
    [2, 3],
  ];

  test("タイルが重なる集合を拒否すること", () => {
    const act = () => buildSlidePuzzlePatternDatabase(4, overlappingPatterns);

    expect(act).toThrow(RangeError);
  });

  const oversizedPatterns = [[1, 2, 3, 4, 5, 6]];

  test("6 枚以上の集合を拒否すること", () => {
    const act = () => buildSlidePuzzlePatternDatabase(4, oversizedPatterns);

    expect(act).toThrow(RangeError);
  });

  const outsideTilePatterns = [[1, 9]];

  test("盤面にないタイルを含む集合を拒否すること", () => {
    const act = () => buildSlidePuzzlePatternDatabase(3, outsideTilePatterns);

    expect(act).toThrow(RangeError);
  });
});
