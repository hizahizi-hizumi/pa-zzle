import { growBridgesIslandTree } from "@/games/bridges/problem/generation/island-tree";
import {
  type BridgesGenerationConditions,
  bridgesBoardSizes,
} from "@/games/bridges/problem/problem";
import {
  assertBridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { isBridgesSolved } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { createProblemSeededRandom } from "@/games/problem-seed";

describe("growBridgesIslandTree", () => {
  const layouts = bridgesBoardSizes.flatMap((size) => {
    const random = createProblemSeededRandom(`island-tree-${size}`);
    const conditions: BridgesGenerationConditions = {
      size,
      islandDensity: 0.3,
      doubleBridgeRate: 0.3,
      extraBridgeRate: 0.15,
      splitRate: 0.2,
    };
    return Array.from({ length: 40 }, () =>
      growBridgesIslandTree(conditions, random),
    ).flatMap((layout) => (layout ? [layout] : []));
  });

  test("作った盤面は、上下左右の端の行・列のどれにも島があること", () => {
    const missing = layouts.filter(({ board }) => {
      const last = board.width - 1;
      const { islands } = board;
      return !(
        islands.some(({ row }) => row === 0) &&
        islands.some(({ row }) => row === last) &&
        islands.some(({ column }) => column === 0) &&
        islands.some(({ column }) => column === last)
      );
    });

    expect({ built: layouts.length > 0, missing }).toEqual({
      built: true,
      missing: [],
    });
  });

  test("島が上下左右に隣り合わない、形の正しい盤面を作ること", () => {
    const errors = layouts.flatMap(({ board }) => {
      try {
        assertBridgesBoard(board);
        return [];
      } catch (error) {
        return [String(error)];
      }
    });

    expect(errors).toEqual([]);
  });

  test("作った橋が、交わらず全島がつながり、数字とちょうど合う解であること", () => {
    const solved = layouts.map(({ board, solution }) =>
      isBridgesSolved(board, { bridges: solution as BridgeCount[] }),
    );

    expect(solved).toEqual(layouts.map(() => true));
  });

  test("2本の橋と輪の橋を含むこと", () => {
    const hasDouble = layouts.some(({ solution }) => solution.includes(2));
    const hasCycle = layouts.some(
      ({ board, solution }) =>
        solution.filter((count) => count > 0).length >= board.islands.length,
    );

    expect([hasDouble, hasCycle]).toEqual([true, true]);
  });

  describe("同じ乱数列の場合", () => {
    const conditions: BridgesGenerationConditions = {
      size: 8,
      islandDensity: 0.24,
      doubleBridgeRate: 0.1,
      extraBridgeRate: 0,
      splitRate: 0,
    };

    test("同じ盤面と解を作ること", () => {
      const results = [0, 1].map(() =>
        growBridgesIslandTree(
          conditions,
          createProblemSeededRandom("island-tree-repeat"),
        ),
      );

      expect(results[0]).toEqual(results[1]);
    });
  });

  test("解の本数が辺の数だけあること", () => {
    const lengths = layouts.map(
      ({ board, solution }) =>
        solution.length === getBridgesNetwork(board).edges.length,
    );

    expect(lengths).toEqual(layouts.map(() => true));
  });

  describe("分割の確率を上げた場合", () => {
    const islandCounts = ([0, 0.2] as const).map((splitRate) => {
      const random = createProblemSeededRandom(
        `island-tree-split-${splitRate}`,
      );
      const counts = Array.from({ length: 60 }, () =>
        growBridgesIslandTree(
          {
            size: 10,
            islandDensity: 0.3,
            doubleBridgeRate: 0.2,
            extraBridgeRate: 0,
            splitRate,
          },
          random,
        ),
      ).flatMap((layout) => (layout ? [layout.board.islands.length] : []));
      return counts.reduce((sum, count) => sum + count, 0) / counts.length;
    });

    test("島の数の平均が増えること", () => {
      const [withoutSplit, withSplit] = islandCounts;

      expect(withSplit!).toBeGreaterThan(withoutSplit!);
    });
  });
});
