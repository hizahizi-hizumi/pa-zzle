import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { traceBridgesHumanSolve } from "@/games/bridges/problem/generation/human-solver";
import { spreadBridgesIslands } from "@/games/bridges/problem/generation/island-spread";
import { refineBridgesLayout } from "@/games/bridges/problem/generation/refinement";
import type { BridgesGenerationConditions } from "@/games/bridges/problem/problem";
import { isBridgesSolved } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { createProblemSeededRandom } from "@/games/problem-seed";

const conditions: BridgesGenerationConditions = {
  size: 8,
  islandDensity: 0.36,
  doubleBridgeRate: 0.65,
  extraBridgeRate: 0.25,
  splitRate: 0.2,
  refinementSteps: 150,
  refinementGoal: "lookahead",
};

/** つながりの読みの手詰まりの回数。 */
function countConnectivityRounds(
  board: Parameters<typeof traceBridgesHumanSolve>[0],
): number {
  return traceBridgesHumanSolve(board, "D").rounds.filter(
    ({ tier }) => tier !== "A1" && tier !== "A2",
  ).length;
}

describe("refineBridgesLayout", () => {
  const pairs = Array.from({ length: 12 }, (_, index) => {
    const random = createProblemSeededRandom(`refinement-${index}`);
    const spread = spreadBridgesIslands(conditions, random);
    return spread
      ? {
          spread,
          refined: refineBridgesLayout(spread, 150, "lookahead", random),
        }
      : null;
  }).flatMap((pair) => (pair?.refined ? [pair] : []));

  test("島の位置を変えず、解いた橋が数字とちょうど合うこと", () => {
    const results = pairs.map(({ spread, refined }) => ({
      sameIslands:
        JSON.stringify(
          spread.board.islands.map(({ row, column }) => [row, column]),
        ) ===
        JSON.stringify(
          refined!.board.islands.map(({ row, column }) => [row, column]),
        ),
      solved: isBridgesSolved(refined!.board, {
        bridges: refined!.solution as BridgeCount[],
      }),
    }));

    expect(pairs.length).toBeGreaterThan(6);
    expect(results).toEqual(
      pairs.map(() => ({ sameIslands: true, solved: true })),
    );
  });

  test("磨いた盤面は一意解で、1手の先読みまでの推理で解き切れること", () => {
    const results = pairs.map(({ refined }) => ({
      solutions: countBridgesSolutions(refined!.board, {
        limit: 2,
        nodeLimit: 200_000,
      }).solutionCount,
      status: traceBridgesHumanSolve(refined!.board, "D").status,
    }));

    expect(results).toEqual(
      pairs.map(() => ({ solutions: 1, status: "solved" })),
    );
  });

  test("磨くと、つながりの読みが要る手詰まりが増えること", () => {
    const before = pairs
      .filter(
        ({ spread }) =>
          traceBridgesHumanSolve(spread.board, "D").status === "solved",
      )
      .map(({ spread }) => countConnectivityRounds(spread.board));
    const after = pairs.map(({ refined }) =>
      countConnectivityRounds(refined!.board),
    );
    const total = (values: readonly number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(total(after)).toBeGreaterThan(total(before));
  });

  describe("同じ盤面を、配分の読みを増やす向き（count）と1手の先読みを増やす向き（lookahead）で磨いた場合", () => {
    const refinedPairs = Array.from({ length: 30 }, (_, index) => {
      const spread = spreadBridgesIslands(
        { ...conditions, size: 7 },
        createProblemSeededRandom(`refinement-goal-${index}`),
      );
      if (spread === null) {
        return null;
      }
      const [count, lookahead] = (["count", "lookahead"] as const).map((goal) =>
        refineBridgesLayout(
          spread,
          150,
          goal,
          createProblemSeededRandom(`refinement-goal-steps-${index}`),
        ),
      );
      return count && lookahead ? { count, lookahead } : null;
    }).flatMap((pair) => (pair ? [pair] : []));

    function countDeepRounds(
      board: Parameters<typeof traceBridgesHumanSolve>[0],
    ): number {
      return traceBridgesHumanSolve(board, "D").rounds.filter(({ tier }) =>
        ["C1g", "C3", "D"].includes(tier),
      ).length;
    }

    test("count の向きの方が、組の読み・通り道・1手の先読みが少ないこと", () => {
      const sum = (goal: "count" | "lookahead") =>
        refinedPairs.reduce(
          (total, pair) => total + countDeepRounds(pair[goal].board),
          0,
        );

      expect(refinedPairs.length).toBeGreaterThan(6);
      expect(sum("count")).toBeLessThan(sum("lookahead"));
    });
  });

  describe("同じ乱数列の場合", () => {
    test("同じ盤面と解に磨くこと", () => {
      const results = [0, 1].map(() => {
        const random = createProblemSeededRandom("refinement-repeat");
        let spread = spreadBridgesIslands(conditions, random);
        while (spread === null) {
          spread = spreadBridgesIslands(conditions, random);
        }
        return refineBridgesLayout(spread, 80, "lookahead", random);
      });

      expect(results[0]).toEqual(results[1]);
    });
  });
});
