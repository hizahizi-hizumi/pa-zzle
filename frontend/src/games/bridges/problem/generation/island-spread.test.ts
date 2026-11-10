import {
  type BridgesSpreadConditions,
  spreadBridgesIslands,
} from "@/games/bridges/problem/generation/island-spread";
import { bridgesBoardSizes } from "@/games/bridges/problem/problem";
import {
  assertBridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { isBridgesSolved } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { createProblemSeededRandom } from "@/games/problem-seed";

function listLayouts(
  conditions: BridgesSpreadConditions,
  seed: string,
  count: number,
) {
  const random = createProblemSeededRandom(seed);
  return Array.from({ length: count }, () =>
    spreadBridgesIslands(conditions, random),
  ).flatMap((layout) => (layout ? [layout] : []));
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("spreadBridgesIslands", () => {
  const layouts = bridgesBoardSizes.flatMap((size) =>
    listLayouts(
      {
        size,
        islandDensity: 0.22,
        doubleBridgeRate: 0.5,
        extraBridgeRate: 0.45,
        splitRate: 0.2,
      },
      `island-spread-${size}`,
      60,
    ),
  );

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

    expect({ built: layouts.length > 100, missing }).toEqual({
      built: true,
      missing: [],
    });
  });

  test("島の数が、盤面のマスの数に島の割合の下限を掛けた数を下回らないこと", () => {
    const short = layouts.filter(
      ({ board }) => board.islands.length < Math.ceil(0.22 * board.width ** 2),
    );

    expect(short).toEqual([]);
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

  test("解の本数が辺の数だけあること", () => {
    const lengths = layouts.map(
      ({ board, solution }) =>
        solution.length === getBridgesNetwork(board).edges.length,
    );

    expect(lengths).toEqual(layouts.map(() => true));
  });

  test("輪のある解を作ること", () => {
    const withLoop = layouts.filter(
      ({ board, solution }) =>
        solution.filter((count) => count > 0).length >= board.islands.length,
    );

    expect(withLoop.length).toBeGreaterThan(layouts.length / 3);
  });

  describe("同じ乱数列の場合", () => {
    const conditions: BridgesSpreadConditions = {
      size: 8,
      islandDensity: 0.26,
      doubleBridgeRate: 0.65,
      extraBridgeRate: 0.25,
      splitRate: 0.45,
    };

    test("同じ盤面と解を作ること", () => {
      const results = [0, 1].map(() =>
        spreadBridgesIslands(
          conditions,
          createProblemSeededRandom("island-spread-repeat"),
        ),
      );

      expect(results[0]).toEqual(results[1]);
    });
  });

  describe("2本の確率を上げた場合", () => {
    const ratios = ([0.5, 0.65] as const).map((doubleBridgeRate) =>
      mean(
        listLayouts(
          {
            size: 9,
            islandDensity: 0.26,
            doubleBridgeRate,
            extraBridgeRate: 0.25,
            splitRate: 0.2,
          },
          `island-spread-double-${doubleBridgeRate}`,
          60,
        ).map(
          ({ solution }) =>
            solution.filter((count) => count === 2).length /
            solution.filter((count) => count > 0).length,
        ),
      ),
    );

    test("2本の組の割合が増えること", () => {
      const [lower, higher] = ratios;

      expect(higher!).toBeGreaterThan(lower!);
    });
  });

  describe("分割の確率を上げた場合", () => {
    const islandCounts = ([0.2, 0.45] as const).map((splitRate) =>
      mean(
        listLayouts(
          {
            size: 10,
            islandDensity: 0,
            doubleBridgeRate: 0.5,
            extraBridgeRate: 0.25,
            splitRate,
          },
          `island-spread-split-${splitRate}`,
          120,
        ).map(({ board }) => board.islands.length),
      ),
    );

    test("島の数の平均が増えること", () => {
      const [withLess, withMore] = islandCounts;

      expect(withMore!).toBeGreaterThan(withLess!);
    });
  });
});
