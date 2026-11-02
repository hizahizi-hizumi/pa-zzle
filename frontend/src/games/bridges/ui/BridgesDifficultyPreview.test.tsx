import { cleanup, render } from "@testing-library/react";

import {
  assessBridgesDifficulty,
  bridgesLevelCombinations,
} from "@/games/bridges/difficulty";
import { analyzeBridgesDifficulty } from "@/games/bridges/problem/difficulty-analysis";
import {
  createBridgesSolverContext,
  createInitialBridgeBounds,
} from "@/games/bridges/problem/generation/bridge-bounds";
import { propagateBridgesCountReasoning } from "@/games/bridges/problem/generation/human-solver";
import { getBridgesSymmetryKey } from "@/games/bridges/problem/generation/symmetry";
import {
  listBridgesPoolEntries,
  toBridgesPooledProblem,
} from "@/games/bridges/problem/problem-pool";
import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import {
  _private,
  BridgesDifficultyPreview,
} from "@/games/bridges/ui/BridgesDifficultyPreview";
import { difficultyLevels } from "@/games/difficulty";

const { createPreviewBoard } = _private;

const difficultyIds = difficultyLevels.map(({ id }) => id);

/** 数字の読み（ちょうど・少なくとも）を尽くしても、橋の本数が決まらない辺を持つ島。 */
function listCountUndecidedIslands(board: BridgesBoard): number[] {
  const context = createBridgesSolverContext(board);
  const bounds = createInitialBridgeBounds(context);
  propagateBridgesCountReasoning(context, bounds);
  const { islandEdges } = getBridgesNetwork(board);
  return board.islands.flatMap((_, island) =>
    islandEdges[island]!.some(
      (edge) => bounds.lower[edge] !== bounds.upper[edge],
    )
      ? [island]
      : [],
  );
}

function medianIslandCount(difficulty: (typeof difficultyIds)[number]): number {
  const counts = listBridgesPoolEntries(difficulty)
    .map((entry) => toBridgesPooledProblem(entry).problem.islands.length)
    .sort((left, right) => left - right);
  return counts[Math.floor(counts.length / 2)]!;
}

afterEach(cleanup);

describe("BridgesDifficultyPreview", () => {
  describe.each(difficultyIds)("レベル %s の縮図", (difficulty) => {
    const { board, markedIslands } = createPreviewBoard(difficulty);

    test("そのレベルに分類される一意解の盤面であること", () => {
      const assessment = assessBridgesDifficulty(
        analyzeBridgesDifficulty(board),
      );

      expect(assessment).toMatchObject({ status: "classified", difficulty });
    });

    test("一辺がそのレベルの盤面の一辺の上限で、島の数が問題集の中央値であること", () => {
      const { width, height, islands } = board;

      expect({ width, height, islandCount: islands.length }).toEqual({
        width: bridgesLevelCombinations[difficulty].boardSize.maximum,
        height: bridgesLevelCombinations[difficulty].boardSize.maximum,
        islandCount: medianIslandCount(difficulty),
      });
    });

    test("問題集の問題と同じ形でないこと", () => {
      const key = getBridgesSymmetryKey(board);
      const poolKeys = difficultyIds.flatMap((level) =>
        listBridgesPoolEntries(level).map((entry) =>
          getBridgesSymmetryKey(toBridgesPooledProblem(entry).problem),
        ),
      );

      expect(poolKeys).not.toContain(key);
    });

    test("輪が数字の読みだけでは決まらない島にちょうど付くこと", () => {
      const undecided = listCountUndecidedIslands(board);

      expect(markedIslands).toEqual(undecided);
    });
  });

  test("上のレベルほど輪が減らないこと", () => {
    const markCounts = difficultyIds.map(
      (difficulty) => createPreviewBoard(difficulty).markedIslands.length,
    );

    expect(markCounts).toEqual([...markCounts].sort((a, b) => a - b));
  });

  describe.each(difficultyIds)("レベル %s の図を描いた場合", (difficulty) => {
    let container: HTMLElement;

    beforeEach(() => {
      container = render(
        <BridgesDifficultyPreview difficulty={difficulty} />,
      ).container;
    });

    test("読み上げから隠し、数字と橋を描かないこと", () => {
      const root = container.firstElementChild;

      expect(root?.getAttribute("aria-hidden")).toBe("true");
      expect(container.querySelectorAll("line, text")).toHaveLength(0);
    });
  });
});
