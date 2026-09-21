import {
  parkingJamDifficultyCalibrationComparisons,
  parkingJamDifficultyCalibrationCorpus,
  restoreParkingJamDifficultyCalibrationProblem,
} from "./difficulty-calibration";

const problems = Object.fromEntries(
  parkingJamDifficultyCalibrationCorpus.map(({ id }) => [
    id,
    restoreParkingJamDifficultyCalibrationProblem(id),
  ]),
);

function features(id: keyof typeof problems) {
  const problem = problems[id];
  if (!problem) throw new Error(`Missing calibration problem: ${id}`);
  return problem.difficultyAnalysis.features;
}

describe("parkingJamDifficultyCalibrationCorpus", () => {
  test("全問題を同一identityから再現して可解性を確認できること", () => {
    const restored = parkingJamDifficultyCalibrationCorpus.map(({ id }) =>
      restoreParkingJamDifficultyCalibrationProblem(id),
    );

    expect(
      restored.every(
        (problem) => problem.solvabilityAnalysis.status === "solvable",
      ),
    ).toBe(true);
  });

  test("小規模で依存が深い問題と大規模で自由な問題を交差させていること", () => {
    const smallDeep = features("small-deep");
    const largeShallow = features("large-shallow");

    expect(problems["small-deep"]?.problem.board.vehicles.length).toBeLessThan(
      problems["large-shallow"]?.problem.board.vehicles.length ?? 0,
    );
    expect(smallDeep.requiredPrecedenceCount ?? 0).toBeGreaterThan(
      largeShallow.requiredPrecedenceCount ?? 0,
    );
    expect(smallDeep.solutionOrderFreedom ?? 1).toBeLessThan(
      largeShallow.solutionOrderFreedom ?? 0,
    );
  });

  test("高密度で自由な問題と低密度でボトルネックのある問題を交差させていること", () => {
    const denseFree = features("dense-free");
    const sparseBottleneck = features("sparse-bottleneck");

    expect(denseFree.vehicleCellOccupancyRatio).toBeGreaterThan(
      sparseBottleneck.vehicleCellOccupancyRatio,
    );
    expect(
      denseFree.requiredPrecedenceCount ?? Number.POSITIVE_INFINITY,
    ).toBeLessThan(sparseBottleneck.requiredPrecedenceCount ?? 0);
    expect(
      denseFree.maximumRequiredPredecessorCount ?? Number.POSITIVE_INFINITY,
    ).toBeLessThan(sparseBottleneck.maximumRequiredPredecessorCount ?? 0);
  });

  test("道路開口量と依存構造を逆向きに組み合わせていること", () => {
    const fewExitsShallow = features("few-exits-shallow");
    const manyExitsDeep = features("many-exits-deep");

    expect(fewExitsShallow.roadOpeningCoverageRatio).toBeLessThan(
      manyExitsDeep.roadOpeningCoverageRatio,
    );
    expect(
      fewExitsShallow.requiredPrecedenceCount ?? Number.POSITIVE_INFINITY,
    ).toBeLessThan(manyExitsDeep.requiredPrecedenceCount ?? 0);
  });
});

describe("parkingJamDifficultyCalibrationComparisons", () => {
  test("交差比較3組と境界比較2組を定義していること", () => {
    const comparisonIds = parkingJamDifficultyCalibrationComparisons.map(
      ({ id }) => id,
    );

    expect(comparisonIds).toEqual([
      "scale-vs-structure",
      "density-vs-bottleneck",
      "openings-vs-dependency",
      "constraint-boundary",
      "visual-load-boundary",
    ]);
  });
});
