import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import { getHamiltonianPathSymmetryKey } from "@/games/hamiltonian-path/problem/generation/symmetry";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import {
  assertHamiltonianPathProblem,
  createHamiltonianPathProblemIdentity,
  type HamiltonianPathProblemIdentity,
  hamiltonianPathBoardSizes,
  hamiltonianPathWallRatios,
} from "@/games/hamiltonian-path/problem/problem";
import { isHamiltonianPathSolved } from "@/games/hamiltonian-path/puzzle/rules";

describe("generateHamiltonianPathProblem", () => {
  const conditions = hamiltonianPathBoardSizes.flatMap((size) =>
    hamiltonianPathWallRatios.map((wallRatio) => [size, wallRatio] as const),
  );
  const identity = createHamiltonianPathProblemIdentity(6, 0, 0);

  test.each(conditions)(
    "一辺 %i・壁率 %s で、条件どおりの壁マス数の一意解の問題を作ること",
    (size, wallRatio) => {
      const { problem, solution } = generateHamiltonianPathProblem(
        createHamiltonianPathProblemIdentity(size, wallRatio, 0),
      );
      const search = countHamiltonianPathSolutions(problem);
      const assertProblem = () => assertHamiltonianPathProblem(problem);

      expect(assertProblem).not.toThrow();
      expect(problem.size).toBe(size);
      expect(problem.walls).toHaveLength(
        size * size - Math.round(size * size * (1 - wallRatio)),
      );
      expect(problem.walls.length + problem.partitions.length).toBeGreaterThan(
        0,
      );
      expect(isHamiltonianPathSolved(problem, solution)).toBe(true);
      expect(search.status).toBe("complete");
      expect(search.solutionCount).toBe(1);
      expect(search.firstSolutions[0]).toEqual(solution);
    },
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
            "0" as HamiltonianPathProblemIdentity["generatorVersion"],
        },
      ],
      [
        "対応していない盤面の大きさ",
        {
          ...identity,
          conditions: {
            size: 10 as HamiltonianPathProblemIdentity["conditions"]["size"],
            wallRatio: 0,
          },
        },
      ],
      [
        "対応していない壁率",
        {
          ...identity,
          conditions: {
            size: 6,
            wallRatio:
              0.3 as HamiltonianPathProblemIdentity["conditions"]["wallRatio"],
          },
        },
      ],
    ];

  test.each(invalidIdentities)("%s を拒否すること", (_, invalidIdentity) => {
    const act = () => generateHamiltonianPathProblem(invalidIdentity);

    expect(act).toThrow();
  });
});
