import { classifyNanpureSolutions } from "./generation/solver";
import { generateNanpureProblem, restoreNanpureProblem } from "./generator";

describe("generateNanpureProblem", () => {
  test("同じseedと生成条件から同じ問題を再現すること", () => {
    const options = {
      seed: "nanpure-reproducible-seed",
      clueCount: 32,
    } as const;

    const first = generateNanpureProblem(options);
    const second = generateNanpureProblem(options);

    expect(second).toEqual(first);
  });

  test("指定したヒント数の一意解問題を生成すること", () => {
    const problem = generateNanpureProblem({
      seed: "nanpure-unique-problem",
      clueCount: 32,
    });

    const clueCount = problem.clues.filter((cell) => cell !== null).length;
    const classification = classifyNanpureSolutions(problem.clues);
    const cluesMatchSolution = problem.clues.every(
      (cell, index) => cell === null || cell === problem.solution[index],
    );

    expect(clueCount).toBe(32);
    expect(classification).toEqual({
      status: "unique",
      solution: problem.solution,
    });
    expect(cluesMatchSolution).toBe(true);
  });

  test("異なるseedから異なる問題を生成すること", () => {
    const first = generateNanpureProblem({
      seed: "nanpure-seed-a",
      clueCount: 32,
    });
    const second = generateNanpureProblem({
      seed: "nanpure-seed-b",
      clueCount: 32,
    });

    expect(second.clues).not.toEqual(first.clues);
  });

  test("保存した問題識別情報から同じ問題を復元すること", () => {
    const problem = generateNanpureProblem({
      seed: "attempt-0",
      clueCount: 24,
      maximumAttempts: 20,
    });

    const restored = restoreNanpureProblem(problem.identity);

    expect(problem.identity.generationAttempt).toBe(2);
    expect(restored).toEqual(problem);
  });

  test("不正なヒント数を拒否すること", () => {
    function act() {
      return generateNanpureProblem({
        seed: "nanpure-invalid-clues",
        clueCount: 16,
      });
    }

    expect(act).toThrow("clueCount must be an integer between 17 and 81");
  });
});
