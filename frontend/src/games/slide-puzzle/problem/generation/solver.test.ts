// @vitest-environment node

import {
  _private,
  solveSlidePuzzleOptimally,
} from "@/games/slide-puzzle/problem/generation/solver";
import { generateSlidePuzzleBoard } from "@/games/slide-puzzle/problem/generator";
import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  listSlidePuzzleSingleMoves,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  createSolvedSlidePuzzleBoard,
  isSlidePuzzleSolved,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";

function shortestDistanceByBreadthFirstSearch(
  initialBoard: SlidePuzzleBoard,
): number {
  const distances = new Map([[initialBoard.join(","), 0]]);
  const queue = [initialBoard];
  for (const board of queue) {
    const distance = distances.get(board.join(",")) ?? 0;
    if (isSlidePuzzleSolved(board)) {
      return distance;
    }
    for (const tileIndex of listSlidePuzzleSingleMoves(board)) {
      const slide = getSlidePuzzleSlide(board, tileIndex);
      const nextBoard = slide ? applySlidePuzzleSlide(board, slide) : board;
      const key = nextBoard.join(",");
      if (!distances.has(key)) {
        distances.set(key, distance + 1);
        queue.push(nextBoard);
      }
    }
  }
  throw new Error("Board is not solvable");
}

function listBoardsWithinDistanceFromSolved(
  maxDistance: number,
): readonly (readonly [SlidePuzzleBoard, number])[] {
  const solvedBoard = createSolvedSlidePuzzleBoard(4);
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

describe("solveSlidePuzzleOptimally", () => {
  const shortScrambles = [
    ["short-1", 6],
    ["short-2", 9],
    ["short-3", 12],
    ["short-4", 12],
    ["short-5", 14],
  ] as const;
  const shortScrambleCases = shortScrambles.map(([seed, scrambleLength]) => {
    const board = generateSlidePuzzleBoard(seed, { size: 4, scrambleLength });
    return [
      seed,
      scrambleLength,
      board,
      shortestDistanceByBreadthFirstSearch(board),
    ] as const;
  });

  test.each(shortScrambleCases)(
    "幅優先探索と同じ最短手数を返すこと: %s を %i 手撹拌",
    (_seed, _scrambleLength, board, optimalMoveCount) => {
      const result = solveSlidePuzzleOptimally(board);

      expect(result).toMatchObject({ status: "solved", optimalMoveCount });
    },
  );

  const solvedBoard = createSolvedSlidePuzzleBoard(4);

  test("完成盤面の最短手数を 0 とすること", () => {
    const result = solveSlidePuzzleOptimally(solvedBoard);

    expect(result).toMatchObject({ status: "solved", optimalMoveCount: 0 });
  });

  const scrambledBoard = generateSlidePuzzleBoard("limit", {
    size: 4,
    scrambleLength: 30,
  });

  test("展開ノード数が上限を超えると limit-exceeded を返すこと", () => {
    const result = solveSlidePuzzleOptimally(scrambledBoard, {
      nodeLimit: 1,
    });

    expect(result).toEqual({ status: "limit-exceeded", expandedNodeCount: 2 });
  });

  const invalidNodeLimits = [0, -1, 1.5, Number.NaN];

  test.each(invalidNodeLimits)(
    "正の整数でない展開ノード数の上限を拒否すること: %s",
    (nodeLimit) => {
      const act = () =>
        solveSlidePuzzleOptimally(scrambledBoard, { nodeLimit });

      expect(act).toThrow(RangeError);
    },
  );

  const unsolvableBoard: SlidePuzzleBoard = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0,
  ];

  test("完成盤面へ到達できない盤面を拒否すること", () => {
    const act = () => solveSlidePuzzleOptimally(unsolvableBoard);

    expect(act).toThrow(RangeError);
  });
});

describe("createSlidePuzzleManhattanLinearConflictHeuristic", () => {
  const heuristic =
    _private.createSlidePuzzleManhattanLinearConflictHeuristic();
  const boardsWithinDistance = listBoardsWithinDistanceFromSolved(12);

  test("完成盤面から 12 手以内の全盤面で、下界が完成までの最短手数を超えないこと", () => {
    const overestimated = boardsWithinDistance.filter(
      ([board, distance]) => heuristic.reset(Uint8Array.from(board)) > distance,
    );

    expect(overestimated).toEqual([]);
  });
});
