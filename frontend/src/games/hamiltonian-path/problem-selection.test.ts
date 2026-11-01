import { difficultyLevels } from "@/games/difficulty";
import { assessHamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import { analyzeHamiltonianPathDifficulty } from "@/games/hamiltonian-path/problem/difficulty-analysis";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import {
  _private,
  selectHamiltonianPathProblemById,
  selectHamiltonianPathProblemForDifficulty,
} from "@/games/hamiltonian-path/problem-selection";
import { createProblemId } from "@/games/problem-id";

const { listProvisionalIdentities } = _private;

describe("listProvisionalIdentities", () => {
  test.each(difficultyLevels.map(({ id }) => id))(
    "レベル %s の仮の候補がどれもそのレベルに分類されること",
    (difficulty) => {
      const difficulties = listProvisionalIdentities(difficulty).map(
        (identity) => {
          const assessment = assessHamiltonianPathDifficulty(
            analyzeHamiltonianPathDifficulty(
              generateHamiltonianPathProblem(identity).problem,
            ),
          );
          return assessment.status === "classified"
            ? assessment.difficulty
            : assessment.status;
        },
      );

      expect(new Set(difficulties)).toEqual(new Set([difficulty]));
    },
    20_000,
  );
});

describe("selectHamiltonianPathProblemForDifficulty", () => {
  const seed = "hamiltonian-path-selection";

  test.each(difficultyLevels.map(({ id }) => id))(
    "レベル %s の仮の候補から問題を作ること",
    (difficulty) => {
      const selected = selectHamiltonianPathProblemForDifficulty(
        difficulty,
        seed,
      );

      expect(listProvisionalIdentities(difficulty)).toContainEqual(
        selected.identity,
      );
      expect(selected.problem.size).toBe(selected.identity.conditions.size);
      expect(selected).not.toHaveProperty("solution");
    },
  );

  test("同じ seed からは同じ問題を選ぶこと", () => {
    const first = selectHamiltonianPathProblemForDifficulty("3", seed);
    const second = selectHamiltonianPathProblemForDifficulty("3", seed);

    expect(second).toEqual(first);
  });
});

describe("selectHamiltonianPathProblemById", () => {
  const selected = selectHamiltonianPathProblemForDifficulty("2", "by-id");
  const problemId = createProblemId(selected.identity);

  test("問題 ID の問題を作ること", () => {
    const result = selectHamiltonianPathProblemById("2", problemId);

    expect(result).toEqual(selected);
  });

  test.each([
    ["別の難易度の問題 ID", "4", problemId],
    ["候補に無い問題 ID", "2", "0000000000"],
  ] as const)("%sには null を返すこと", (_, difficulty, id) => {
    const result = selectHamiltonianPathProblemById(difficulty, id);

    expect(result).toBeNull();
  });
});
