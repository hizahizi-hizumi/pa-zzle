import { assessParkingJamDifficulty } from "./difficulty";
import { generateParkingJamProblemForDifficulty } from "./problem-selection";

describe("generateParkingJamProblemForDifficulty", () => {
  const difficulties = ["easy", "normal", "hard"] as const;

  test.each(difficulties)("%s と判定できる問題を生成すること", (difficulty) => {
    const problem = generateParkingJamProblemForDifficulty(
      difficulty,
      `parking-jam-${difficulty}-selection`,
    );

    const assessment = assessParkingJamDifficulty(problem.difficultyAnalysis);

    expect(assessment).toMatchObject({
      status: "rated",
      difficulty,
    });
  });
});

describe("hard の代表seed群の場合", () => {
  const seeds = Array.from(
    { length: 10 },
    (_, index) => `parking-jam-hard-supply-${index}`,
  );

  test.each(seeds)("継続してhard問題を供給できること: %s", (seed) => {
    const problem = generateParkingJamProblemForDifficulty("hard", seed);

    const assessment = assessParkingJamDifficulty(problem.difficultyAnalysis);

    expect(assessment).toMatchObject({
      status: "rated",
      difficulty: "hard",
    });
  });
});
