// @vitest-environment node

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
  isFifteenPuzzleSolved,
} from "@/games/fifteen-puzzle/puzzle/state";

function shortestDistanceByBreadthFirstSearch(
  initialBoard: FifteenPuzzleBoard,
): number {
  const distances = new Map([[initialBoard.join(","), 0]]);
  const queue = [initialBoard];
  for (const board of queue) {
    const distance = distances.get(board.join(",")) ?? 0;
    if (isFifteenPuzzleSolved(board)) {
      return distance;
    }
    for (const tileIndex of listFifteenPuzzleSingleMoves(board)) {
      const slide = getFifteenPuzzleSlide(board, tileIndex);
      const nextBoard = slide ? applyFifteenPuzzleSlide(board, slide) : board;
      const key = nextBoard.join(",");
      if (!distances.has(key)) {
        distances.set(key, distance + 1);
        queue.push(nextBoard);
      }
    }
  }
  throw new Error("Board is not solvable");
}

describe("solveFifteenPuzzleOptimally", () => {
  const shortScrambles = [
    ["short-1", 6],
    ["short-2", 9],
    ["short-3", 12],
    ["short-4", 12],
    ["short-5", 14],
  ] as const;
  const shortScrambleCases = shortScrambles.map(
    ([seed, scrambleLength]) =>
      [
        seed,
        scrambleLength,
        generateFifteenPuzzleBoard(seed, { size: 4, scrambleLength }),
      ] as const,
  );

  test.each(shortScrambleCases)(
    "幅優先探索と同じ最短手数を返すこと: %s を %i 手撹拌",
    (_seed, _scrambleLength, board) => {
      const result = solveFifteenPuzzleOptimally(board);

      expect(result).toMatchObject({
        status: "solved",
        optimalMoveCount: shortestDistanceByBreadthFirstSearch(board),
      });
    },
  );

  const solvedBoard = createSolvedFifteenPuzzleBoard();

  test("完成盤面の最短手数を 0 とすること", () => {
    const result = solveFifteenPuzzleOptimally(solvedBoard);

    expect(result).toMatchObject({ status: "solved", optimalMoveCount: 0 });
  });

  const scrambledBoard = generateFifteenPuzzleBoard("limit", {
    size: 4,
    scrambleLength: 30,
  });

  test("展開ノード数が上限を超えると limit-exceeded を返すこと", () => {
    const result = solveFifteenPuzzleOptimally(scrambledBoard, {
      nodeLimit: 1,
    });

    expect(result).toEqual({ status: "limit-exceeded", expandedNodeCount: 2 });
  });

  const invalidNodeLimits = [0, -1, 1.5, Number.NaN];

  test.each(invalidNodeLimits)(
    "正の整数でない展開ノード数の上限を拒否すること: %s",
    (nodeLimit) => {
      const act = () =>
        solveFifteenPuzzleOptimally(scrambledBoard, { nodeLimit });

      expect(act).toThrow(RangeError);
    },
  );

  const unsolvableBoard: FifteenPuzzleBoard = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0,
  ];

  test("完成盤面へ到達できない盤面を拒否すること", () => {
    const act = () => solveFifteenPuzzleOptimally(unsolvableBoard);

    expect(act).toThrow(RangeError);
  });
});
