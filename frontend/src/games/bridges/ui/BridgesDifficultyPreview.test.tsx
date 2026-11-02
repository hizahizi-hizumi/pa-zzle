import { cleanup, render } from "@testing-library/react";

import {
  assessBridgesDifficulty,
  type BridgesLevelCombination,
  bridgesLevelCombinations,
} from "@/games/bridges/difficulty";
import { analyzeBridgesDifficulty } from "@/games/bridges/problem/difficulty-analysis";
import {
  createBridgesSolverContext,
  createInitialBridgeBounds,
} from "@/games/bridges/problem/generation/bridge-bounds";
import { propagateBridgesCountReasoning } from "@/games/bridges/problem/generation/human-solver";
import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import {
  _private,
  BridgesDifficultyPreview,
} from "@/games/bridges/ui/BridgesDifficultyPreview";
import { difficultyLevels, isInNumericRange } from "@/games/difficulty";

const { createPreviewStrip } = _private;

const difficultyIds = difficultyLevels.map(({ id }) => id);

/** 帯は盤面の一部なので、島の数の下限は帯には当てない。 */
const stripCombinationKeys = [
  "boardSize",
  "openingEdgeRatio",
  "countRoundCount",
  "connectivityRoundCount",
  "countReasoningUndecidedRatio",
] as const satisfies readonly (keyof BridgesLevelCombination)[];

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

afterEach(cleanup);

describe("BridgesDifficultyPreview", () => {
  describe.each(difficultyIds)("レベル %s の帯", (difficulty) => {
    const { board, markedIslands } = createPreviewStrip(difficulty);

    test("一意解で、試し置きなしで解けること", () => {
      const analysis = analyzeBridgesDifficulty(board);

      expect(analysis).toMatchObject({
        status: "analyzed",
        requiresTrial: false,
      });
    });

    test("島の数を除き、そのレベルの組み合わせに入ること", () => {
      const assessment = assessBridgesDifficulty(
        analyzeBridgesDifficulty(board),
      );
      const features =
        "features" in assessment ? assessment.features : undefined;

      const misses = stripCombinationKeys.filter(
        (key) =>
          features === undefined ||
          !isInNumericRange(
            features[key],
            bridgesLevelCombinations[difficulty][key],
          ),
      );

      expect(misses).toEqual([]);
    });

    test("帯の幅がそのレベルの盤面の一辺の上限であること", () => {
      const width = board.width;

      expect(width).toBe(
        bridgesLevelCombinations[difficulty].boardSize.maximum,
      );
    });

    test("印が数字の読みだけでは決まらない島にちょうど付くこと", () => {
      const undecided = listCountUndecidedIslands(board);

      expect(markedIslands).toEqual(undecided);
    });
  });

  test("どのレベルの帯も4行であること", () => {
    const heights = difficultyIds.map(
      (difficulty) => createPreviewStrip(difficulty).board.height,
    );

    expect(new Set(heights)).toEqual(new Set([4]));
  });

  test("上のレベルほど島が多いこと", () => {
    const islandCounts = difficultyIds.map(
      (difficulty) => createPreviewStrip(difficulty).board.islands.length,
    );

    expect(islandCounts).toEqual([...islandCounts].sort((a, b) => a - b));
    expect(new Set(islandCounts).size).toBe(islandCounts.length);
  });

  test("上のレベルほど印が減らないこと", () => {
    const markCounts = difficultyIds.map(
      (difficulty) => createPreviewStrip(difficulty).markedIslands.length,
    );

    expect(markCounts).toEqual([...markCounts].sort((a, b) => a - b));
  });

  test.each(difficultyIds)(
    "レベル %s の図は読み上げから隠し、橋を描かないこと",
    (difficulty) => {
      const { container } = render(
        <BridgesDifficultyPreview difficulty={difficulty} />,
      );

      const root = container.firstElementChild;

      expect(root?.getAttribute("aria-hidden")).toBe("true");
      expect(container.querySelectorAll("line")).toHaveLength(0);
    },
  );
});
