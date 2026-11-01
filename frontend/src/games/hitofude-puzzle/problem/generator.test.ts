import { countHamiltonianPathHoleLayoutViolations } from "@/games/hamiltonian-path/problem/generation/hole-layout";
import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import { getHamiltonianPathSymmetryKey } from "@/games/hamiltonian-path/problem/generation/symmetry";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import {
  assertHamiltonianPathProblem,
  createHamiltonianPathProblemIdentity,
  type HamiltonianPathProblemIdentity,
  hamiltonianPathBoardSizes,
} from "@/games/hamiltonian-path/problem/problem";
import { isHamiltonianPathSolved } from "@/games/hamiltonian-path/puzzle/rules";

/** 8×8 の焼きなましと 7×7 の難しさへの歩行は1問に数秒かかる。 */
const GENERATION_TIMEOUT_MS = 60_000;

describe("generateHamiltonianPathProblem", () => {
  const conditions = [
    ...hamiltonianPathBoardSizes.map((size) => [size, 0] as const),
    [7, 4] as const,
  ];
  const identity = createHamiltonianPathProblemIdentity(6, 0, 0);

  test.each(conditions)(
    "一辺 %i・仮置きの回数の目標 %i で、穴が見た目の基準を満たす一意解の問題を作ること",
    (size, targetAssumptionCount) => {
      const { problem, solution } = generateHamiltonianPathProblem(
        createHamiltonianPathProblemIdentity(size, targetAssumptionCount, 0),
      );
      const search = countHamiltonianPathSolutions(problem);
      const assertProblem = () => assertHamiltonianPathProblem(problem);

      expect(assertProblem).not.toThrow();
      expect(problem.size).toBe(size);
      expect(countHamiltonianPathHoleLayoutViolations(problem)).toBe(0);
      expect(isHamiltonianPathSolved(problem, solution)).toBe(true);
      expect(search.status).toBe("complete");
      expect(search.solutionCount).toBe(1);
      expect(search.firstSolutions[0]).toEqual(solution);
    },
    GENERATION_TIMEOUT_MS,
  );

  test("問題の同型判定キーを返すこと", () => {
    const generated = generateHamiltonianPathProblem(identity);

    expect(generated.symmetryKey).toBe(
      getHamiltonianPathSymmetryKey(generated.problem),
    );
  });

  test("同じ identity から同じ問題を作り、identity をそのまま返すこと", () => {
    const first = generateHamiltonianPathProblem(identity);
    const second = generateHamiltonianPathProblem(structuredClone(identity));

    expect(second.problem).toEqual(first.problem);
    expect(second.identity).toEqual(identity);
  });

  test("seed が違えば別の問題を作ること", () => {
    const first = generateHamiltonianPathProblem(identity);
    const other = generateHamiltonianPathProblem(
      createHamiltonianPathProblemIdentity(6, 0, 1),
    );

    expect(other.problem).not.toEqual(first.problem);
  });

  const invalidIdentities: readonly [string, HamiltonianPathProblemIdentity][] =
    [
      [
        "対応していない生成器の版",
        {
          ...identity,
          generatorVersion:
            "1" as HamiltonianPathProblemIdentity["generatorVersion"],
        },
      ],
      [
        "対応していない盤面の大きさ",
        {
          ...identity,
          conditions: {
            size: 10 as HamiltonianPathProblemIdentity["conditions"]["size"],
            targetAssumptionCount: 0,
          },
        },
      ],
      [
        "対応していない仮置きの回数の目標",
        {
          ...identity,
          conditions: {
            size: 6,
            targetAssumptionCount:
              5 as HamiltonianPathProblemIdentity["conditions"]["targetAssumptionCount"],
          },
        },
      ],
    ];

  test.each(invalidIdentities)("%s を拒否すること", (_, invalidIdentity) => {
    const act = () => generateHamiltonianPathProblem(invalidIdentity);

    expect(act).toThrow();
  });
});
