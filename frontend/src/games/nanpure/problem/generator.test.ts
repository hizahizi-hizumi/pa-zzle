import { classifyNanpureSolutions } from "./generation/solver";
import { generateNanpureProblem, restoreNanpureProblem } from "./generator";

describe("generateNanpureProblem", () => {
  const reproducibleOptions = {
    seed: "nanpure-reproducible-seed",
    clueCount: 32,
  } as const;
  const uniqueProblemOptions = {
    seed: "nanpure-unique-problem",
    clueCount: 32,
  } as const;
  const differentSeedOptions = [
    { seed: "nanpure-seed-a", clueCount: 32 },
    { seed: "nanpure-seed-b", clueCount: 32 },
  ] as const;
  const restoreOptions = {
    seed: "attempt-0",
    clueCount: 24,
    maximumAttempts: 20,
  } as const;
  const invalidClueOptions = {
    seed: "nanpure-invalid-clues",
    clueCount: 16,
  } as const;

  test("同じseedと生成条件から同じ問題を再現すること", () => {
    const first = generateNanpureProblem(reproducibleOptions);
    const second = generateNanpureProblem(reproducibleOptions);

    expect(second).toEqual(first);
  });

  test("指定したヒント数の一意解問題を生成すること", () => {
    const problem = generateNanpureProblem(uniqueProblemOptions);
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
    const first = generateNanpureProblem(differentSeedOptions[0]);
    const second = generateNanpureProblem(differentSeedOptions[1]);

    expect(second.clues).not.toEqual(first.clues);
  });

  test("保存した問題識別情報から同じ問題を復元すること", () => {
    const problem = generateNanpureProblem(restoreOptions);
    const restored = restoreNanpureProblem(problem.identity);

    expect(problem.identity.generationAttempt).toBe(2);
    expect(restored).toEqual(problem);
  });

  test("不正なヒント数を拒否すること", () => {
    const act = () => generateNanpureProblem(invalidClueOptions);

    expect(act).toThrow("clueCount must be an integer between 17 and 81");
  });
});
