import { assessParkingJamDifficulty } from "./difficulty";
import { generateParkingJamProblemForDifficulty } from "./problem-selection";

describe("generateParkingJamProblemForDifficulty", () => {
  const difficultyCases = [
    ["easy", 8],
    ["normal", 12],
    ["hard", 14],
  ] as const;

  test.each(difficultyCases)(
    "%s と判定できる規模の問題を生成すること",
    (difficulty, expectedVehicleCount) => {
      const problem = generateParkingJamProblemForDifficulty(
        difficulty,
        `parking-jam-${difficulty}-selection`,
      );
      const assessment = assessParkingJamDifficulty(problem.difficultyAnalysis);

      expect(assessment).toMatchObject({
        status: "rated",
        difficulty,
      });
      expect(problem.problem.board.vehicles).toHaveLength(expectedVehicleCount);
    },
  );

  describe.each(difficultyCases)("%s の代表seed群の場合", (difficulty) => {
    const seeds = Array.from(
      { length: 10 },
      (_, index) => `parking-jam-${difficulty}-supply-${index}`,
    );

    test.each(seeds)("継続して指定難易度を供給できること: %s", (seed) => {
      const problem = generateParkingJamProblemForDifficulty(difficulty, seed);
      const assessment = assessParkingJamDifficulty(problem.difficultyAnalysis);

      expect(assessment).toMatchObject({
        status: "rated",
        difficulty,
      });
    });
  });
});
