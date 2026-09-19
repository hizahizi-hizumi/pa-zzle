import { validateParkingJamBoard } from "../puzzle/board";
import {
  generateParkingJamProblem,
  restoreParkingJamProblem,
} from "./generator";

describe("generateParkingJamProblem", () => {
  const options = {
    seed: "parking-jam-reproducible",
    width: 8,
    height: 8,
    vehicleCount: 14,
    obstacleCount: 4,
    exitProbability: 0.45,
  } as const;

  test("同じseedと生成条件から同じ問題を再現すること", () => {
    const first = generateParkingJamProblem(options);
    const second = generateParkingJamProblem(options);

    expect(second).toEqual(first);
  });

  test("生成した問題が幾何的に妥当で可解であること", () => {
    const generated = generateParkingJamProblem(options);
    const validate = () => validateParkingJamBoard(generated.problem.board);

    expect(validate).not.toThrow();
    expect(generated.solvabilityAnalysis.status).toBe("solvable");
    expect(generated.solvabilityAnalysis.solution).toHaveLength(
      options.vehicleCount,
    );
  });

  test("保存した問題識別情報から同じ問題を復元できること", () => {
    const generated = generateParkingJamProblem(options);

    const restored = restoreParkingJamProblem(generated.identity);

    expect(restored).toEqual(generated);
  });

  test("生成器と独立した採用条件で候補を棄却できること", () => {
    let candidateCount = 0;

    const generated = generateParkingJamProblem({
      ...options,
      seed: "parking-jam-acceptance",
      acceptCandidate: () => {
        candidateCount += 1;
        return candidateCount >= 2;
      },
    });

    expect(candidateCount).toBe(2);
    expect(generated.identity.generationAttempt).toBeGreaterThan(1);
  });

  describe("代表条件の複数seedの場合", () => {
    const seeds = Array.from(
      { length: 10 },
      (_, index) => `parking-jam-batch-${index}`,
    );

    test("可解な問題を継続して供給できること", () => {
      const generatedProblems = seeds.map((seed) =>
        generateParkingJamProblem({ ...options, seed }),
      );

      expect(generatedProblems).toHaveLength(seeds.length);
      expect(
        generatedProblems.every(
          (generated) => generated.solvabilityAnalysis.status === "solvable",
        ),
      ).toBe(true);
    });
  });
});
