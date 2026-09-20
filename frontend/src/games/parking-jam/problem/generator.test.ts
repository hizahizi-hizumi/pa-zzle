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
    roadOpeningCount: 4,
    roadOpeningSpan: 4,
    fixedAreaCount: 1,
    fixedAreaLength: 2,
  } as const;
  let candidateCount = 0;

  beforeEach(() => {
    candidateCount = 0;
  });

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

  describe("遮断依存を優先して生成する場合", () => {
    const blockingOptions = {
      ...options,
      seed: "parking-jam-blocking-reproducible",
      blockingPlacementProbability: 1,
    } as const;

    test("問題識別情報から同じ問題を復元できること", () => {
      const generated = generateParkingJamProblem(blockingOptions);

      const restored = restoreParkingJamProblem(generated.identity);

      expect(generated.identity.conditions.blockingPlacementProbability).toBe(
        blockingOptions.blockingPlacementProbability,
      );
      expect(restored).toEqual(generated);
    });
  });
});

describe("盤面規模が異なる場合", () => {
  const cases = [
    {
      label: "6×6",
      options: {
        seed: "parking-jam-size-6",
        width: 6,
        height: 6,
        vehicleCount: 8,
        roadOpeningCount: 3,
        roadOpeningSpan: 2,
        fixedAreaCount: 1,
        fixedAreaLength: 2,
      },
    },
    {
      label: "6×8",
      options: {
        seed: "parking-jam-size-6x8",
        width: 6,
        height: 8,
        vehicleCount: 10,
        roadOpeningCount: 3,
        roadOpeningSpan: 3,
        fixedAreaCount: 1,
        fixedAreaLength: 3,
      },
    },
  ] as const;

  test.each(cases)("$label でも可解な問題を生成できること", ({ options }) => {
    const generated = generateParkingJamProblem(options);

    expect(generated.solvabilityAnalysis.status).toBe("solvable");
    expect(generated.problem.board.width).toBe(options.width);
    expect(generated.problem.board.height).toBe(options.height);
    expect(generated.problem.board.roadOpenings).toHaveLength(
      options.roadOpeningCount,
    );
    expect(
      generated.problem.board.roadOpenings.every(
        (opening) => opening.length === options.roadOpeningSpan,
      ),
    ).toBe(true);
    expect(generated.problem.board.fixedAreas).toHaveLength(
      options.fixedAreaCount,
    );
  });
});

describe("道路開口数が盤面上限を超える場合", () => {
  const options = {
    seed: "parking-jam-impossible-openings",
    width: 4,
    height: 4,
    vehicleCount: 2,
    roadOpeningCount: 5,
    roadOpeningSpan: 4,
    fixedAreaCount: 0,
    fixedAreaLength: 1,
  } as const;

  test("生成試行に入る前に拒否すること", () => {
    const generate = () => generateParkingJamProblem(options);

    expect(generate).toThrow("roadOpeningCount must be at most 4");
  });
});
