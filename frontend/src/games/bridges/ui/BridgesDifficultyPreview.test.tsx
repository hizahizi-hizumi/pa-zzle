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

const { PREVIEW_ROWS, createPreviewBoard } = _private;

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

function pairAdjacentLevels<Value>(values: readonly Value[]): [Value, Value][] {
  return values.slice(1).map((upper, index) => [values[index]!, upper]);
}

afterEach(cleanup);

describe("createPreviewBoard", () => {
  describe.each(difficultyIds)("レベル %s の場合", (difficulty) => {
    const { board, top, shownIslands, markedIslands } =
      createPreviewBoard(difficulty);

    test("盤面がそのレベルに分類される一意解の盤面であること", () => {
      const assessment = assessBridgesDifficulty(
        analyzeBridgesDifficulty(board),
      );

      expect(assessment).toMatchObject({ status: "classified", difficulty });
    });

    test("盤面の一辺がそのレベルの盤面の一辺の上限で、描く行が盤面に収まること", () => {
      const { width, height } = board;

      expect({ width, height, fits: top + PREVIEW_ROWS <= height }).toEqual({
        width: bridgesLevelCombinations[difficulty].boardSize.maximum,
        height: bridgesLevelCombinations[difficulty].boardSize.maximum,
        fits: true,
      });
    });

    test("盤面が問題集の問題と同じ形でないこと", () => {
      const key = getBridgesSymmetryKey(board);
      const poolKeys = difficultyIds.flatMap((level) =>
        listBridgesPoolEntries(level).map((entry) =>
          getBridgesSymmetryKey(toBridgesPooledProblem(entry).problem),
        ),
      );

      expect(poolKeys).not.toContain(key);
    });

    test("描く行の島のうち、数字の読みだけでは決まらない島にちょうど輪を付けること", () => {
      const undecided = new Set(listCountUndecidedIslands(board));
      const expected = shownIslands.filter((island) => undecided.has(island));

      expect(markedIslands).toEqual(expected);
    });
  });

  describe("レベルを並べた場合", () => {
    const previews = difficultyIds.map((difficulty) =>
      createPreviewBoard(difficulty),
    );

    test("上のレベルほど横幅が狭くならないこと", () => {
      const pairs = pairAdjacentLevels(
        previews.map(({ board }) => board.width),
      );

      for (const [lower, upper] of pairs) {
        expect(upper).toBeGreaterThanOrEqual(lower);
      }
    });

    test("上のレベルほど描く島が減らないこと", () => {
      const pairs = pairAdjacentLevels(
        previews.map(({ shownIslands }) => shownIslands.length),
      );

      for (const [lower, upper] of pairs) {
        expect(upper).toBeGreaterThanOrEqual(lower);
      }
    });

    test("レベル1・2 に輪が無く、レベル3 から上のレベルほど輪が3つ以上増えること", () => {
      const markCounts = previews.map(
        ({ markedIslands }) => markedIslands.length,
      );
      const increases = pairAdjacentLevels(markCounts.slice(2)).map(
        ([lower, upper]) => upper - lower,
      );

      expect(markCounts.slice(0, 2)).toEqual([0, 0]);
      for (const increase of increases) {
        expect(increase).toBeGreaterThanOrEqual(3);
      }
    });
  });
});

describe("BridgesDifficultyPreview", () => {
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
