import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { growBridgesIslandTree } from "@/games/bridges/problem/generation/island-tree";
import researchCases from "@/games/bridges/problem/generation/research-solver-cases.json";
import {
  type BridgesBoard,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import { isBridgesSolved } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { createProblemSeededRandom } from "@/games/problem-seed";

describe("countBridgesSolutions", () => {
  describe("研究用の解法器（scripts/research/bridges_parity_cases.py）で数えた盤面の場合", () => {
    const cases = researchCases.map((researchCase) => ({
      ...researchCase,
      parsed: parseBridgesBoard(researchCase.board.split("/")),
    }));

    test("解の数と探索した局面の数が一致すること", () => {
      const counts = cases.map(({ parsed }) => {
        const result = countBridgesSolutions(parsed, {
          limit: 2,
          nodeLimit: 200_000,
        });
        return [
          result.solutionCount,
          result.nodeCount,
          result.exceededNodeLimit,
        ];
      });

      expect(counts).toEqual(
        cases.map(({ solutionCount, nodeCount, exceededNodeLimit }) => [
          solutionCount,
          nodeCount,
          exceededNodeLimit,
        ]),
      );
    });

    test("つながりを無視した解の数と探索した局面の数が一致すること", () => {
      const counts = cases.map(({ parsed }) => {
        const result = countBridgesSolutions(parsed, {
          limit: 20,
          ignoresConnectivity: true,
          nodeLimit: 100_000,
        });
        return [result.solutionCount, result.nodeCount];
      });

      expect(counts).toEqual(
        cases.map(({ unconnectedSolutionCount, unconnectedNodeCount }) => [
          unconnectedSolutionCount,
          unconnectedNodeCount,
        ]),
      );
    });
  });

  /** 全ての本数の組を並べ、規則を満たす配置を数える。 */
  function countByBruteForce(board: BridgesBoard): number {
    const edgeCount = getBridgesNetwork(board).edges.length;
    let count = 0;
    for (let code = 0; code < 3 ** edgeCount; code += 1) {
      const bridges: BridgeCount[] = [];
      for (let edge = 0, rest = code; edge < edgeCount; edge += 1) {
        bridges.push((rest % 3) as BridgeCount);
        rest = Math.floor(rest / 3);
      }
      if (isBridgesSolved(board, { bridges })) {
        count += 1;
      }
    }
    return count;
  }

  describe("小さな盤面を総当たりで数えた場合", () => {
    // 解のある盤面を作るため、生成器で木と輪の橋を置いてから、一部の島の数字を1つずらして解の無い盤面や複数ある盤面も混ぜる。
    const random = createProblemSeededRandom("bridges-exact-solver");
    const boards = Array.from({ length: 300 }, (_, index) => {
      const layout = growBridgesIslandTree(
        {
          size: 6,
          islandDensity: 0.24,
          doubleBridgeRate: 0.3,
          extraBridgeRate: 0.15,
          splitRate: 0.2,
        },
        random,
      )!;
      return index % 3 === 0
        ? {
            ...layout.board,
            islands: layout.board.islands.map((island, islandIndex) =>
              islandIndex === 0
                ? { ...island, clue: Math.min(8, island.clue + 1) }
                : island,
            ),
          }
        : layout.board;
    }).filter((board) => getBridgesNetwork(board).edges.length <= 9);

    test("解の数が総当たりと一致すること", () => {
      const counts = boards.map(
        (board) =>
          countBridgesSolutions(board, { limit: 1_000, nodeLimit: 100_000 })
            .solutionCount,
      );

      expect(counts).toEqual(boards.map(countByBruteForce));
    });

    test("解の無い盤面・1つの盤面・2つ以上の盤面を、それぞれ十分な数だけ試していること", () => {
      const counts = boards.map(countByBruteForce);
      const smallestGroup = Math.min(
        counts.filter((count) => count === 0).length,
        counts.filter((count) => count === 1).length,
        counts.filter((count) => count >= 2).length,
      );

      expect(smallestGroup).toBeGreaterThanOrEqual(10);
    });
  });

  describe("局面の数の上限を超えた場合", () => {
    const board = parseBridgesBoard(researchCases[0]!.board.split("/"));

    test("打ち切ったことを返すこと", () => {
      const result = countBridgesSolutions(board, { limit: 2, nodeLimit: 0 });

      expect(result).toMatchObject({
        exceededNodeLimit: true,
        solutionCount: 0,
      });
    });
  });
});
