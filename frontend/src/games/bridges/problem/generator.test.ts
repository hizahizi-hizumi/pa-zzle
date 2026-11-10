import { getBridgesSymmetryKey } from "@/games/bridges/problem/generation/symmetry";
import { generateBridgesProblem } from "@/games/bridges/problem/generator";
import {
  type BridgesProblemIdentity,
  createBridgesProblemIdentity,
} from "@/games/bridges/problem/problem";
import { isBridgesSolved } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";

describe("generateBridgesProblem", () => {
  const identity = createBridgesProblemIdentity(
    {
      size: 10,
      islandDensity: 0.36,
      doubleBridgeRate: 0.5,
      extraBridgeRate: 0.15,
      splitRate: 0.45,
      refinementSteps: 150,
    },
    12,
  );

  test("同じ identity からは同じ問題を作ること", () => {
    const problems = [0, 1].map(() => generateBridgesProblem(identity));

    expect(problems[0]).toEqual(problems[1]);
  });

  test("作った橋が問題の解で、正規化キーを添えること", () => {
    const { problem, solution, symmetryKey } = generateBridgesProblem(identity);

    expect({
      solved: isBridgesSolved(problem, { bridges: solution as BridgeCount[] }),
      symmetryKey,
    }).toEqual({ solved: true, symmetryKey: getBridgesSymmetryKey(problem) });
  });

  test.each([
    ["別の生成器の版", { ...identity, generatorVersion: "0" }],
    [
      "扱わない生成条件",
      { ...identity, conditions: { ...identity.conditions, size: 5 } },
    ],
  ])("%sの identity を拒むこと", (_, invalid) => {
    const act = () =>
      generateBridgesProblem(invalid as unknown as BridgesProblemIdentity);

    expect(act).toThrow();
  });
});
