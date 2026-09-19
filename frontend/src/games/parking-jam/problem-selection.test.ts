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
