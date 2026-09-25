// @vitest-environment node

import { buildSlidePuzzleAllStateDistances } from "@/games/slide-puzzle/problem/generation/all-state-distances";
import { solveSlidePuzzleOptimally } from "@/games/slide-puzzle/problem/generation/solver";
import { generateSlidePuzzleBoard } from "@/games/slide-puzzle/problem/generator";

describe("buildSlidePuzzleAllStateDistances", () => {
  const table = buildSlidePuzzleAllStateDistances();

  test("3×3 の可解な 181,440 配置をすべてたどること", () => {
    const reachableCount = table.countsByDistance.reduce(
      (total, count) => total + count,
      0,
    );

    expect(reachableCount).toBe(181_440);
  });

  test("最短手数の最大を 31 手とすること", () => {
    const maximumDistance = table.countsByDistance.length - 1;

    expect(maximumDistance).toBe(31);
  });

  const cases = [
    ["all-1", 30],
    ["all-2", 60],
    ["all-3", 200],
  ] as const;
  const boards = cases.map(([seed, scrambleLength]) => {
    const board = generateSlidePuzzleBoard(seed, { size: 3, scrambleLength });
    const solved = solveSlidePuzzleOptimally(board);
    return [
      seed,
      board,
      solved.status === "solved" ? solved.optimalMoveCount : null,
    ] as const;
  });

  test.each(boards)(
    "反復深化 A* と同じ最短手数を引けること: %s",
    (_seed, board, optimalMoveCount) => {
      const result = table.distanceOf(board);

      expect(result).toBe(optimalMoveCount);
    },
  );

  const unsolvableBoard = [1, 2, 3, 4, 5, 6, 8, 7, 0];

  test("完成盤面へ到達できない配置では null を返すこと", () => {
    const result = table.distanceOf(unsolvableBoard);

    expect(result).toBeNull();
  });
});
