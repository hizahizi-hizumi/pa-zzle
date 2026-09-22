import { assessParkingJamReviewDifficulty } from "./difficulty";
import {
  _private,
  generateParkingJamProblemForDifficulty,
} from "./problem-selection";

const { listParkingJamReviewSupplyConditions } = _private;

describe("generateParkingJamProblemForDifficulty", () => {
  const supplyCases = [
    { difficulty: "easy", seed: "parking-jam-r3-review-supply-easy-0" },
    { difficulty: "easy", seed: "parking-jam-r3-review-supply-easy-1" },
    { difficulty: "easy", seed: "parking-jam-r3-review-supply-easy-2" },
    { difficulty: "normal", seed: "parking-jam-r3-review-supply-normal-0" },
    { difficulty: "normal", seed: "parking-jam-r3-review-supply-normal-1" },
    { difficulty: "normal", seed: "parking-jam-r3-review-supply-normal-2" },
    { difficulty: "hard", seed: "parking-jam-r3-review-supply-hard-0" },
    { difficulty: "hard", seed: "parking-jam-r3-review-supply-hard-1" },
    { difficulty: "hard", seed: "parking-jam-r3-review-supply-hard-2" },
  ] as const;

  test.each(supplyCases)(
    "$difficulty のレビュー候補を $seed から供給すること",
    ({ difficulty, seed }) => {
      const problem = generateParkingJamProblemForDifficulty(difficulty, seed);
      const assessment = assessParkingJamReviewDifficulty(
        problem.difficultyAnalysis,
      );

      expect(assessment).toMatchObject({
        status: "rated",
        difficulty,
      });
    },
  );

  test("同じseedから同じ問題を再現すること", () => {
    const seed = "parking-jam-r3-review-supply-reproducible";

    const first = generateParkingJamProblemForDifficulty("hard", seed);
    const second = generateParkingJamProblemForDifficulty("hard", seed);

    expect(first).toEqual(second);
  });
});

describe("listParkingJamReviewSupplyConditions", () => {
  const seed = "parking-jam-r3-review-supply-order";

  test("難易度に依存しない候補条件を決定論的に並べること", () => {
    const first = listParkingJamReviewSupplyConditions(seed);
    const second = listParkingJamReviewSupplyConditions(seed);

    expect(first).toEqual(second);
    expect(first).toHaveLength(72);
    expect(first.every((conditions) => !("difficulty" in conditions))).toBe(
      true,
    );
  });

  test("盤面規模と車両数の複数条件を候補に残すこと", () => {
    const conditions = listParkingJamReviewSupplyConditions(seed);
    const boardSizes = new Set(
      conditions.map(({ width, height }) => `${width}x${height}`),
    );
    const vehicleCounts = new Set(
      conditions.map(({ vehicleCount }) => vehicleCount),
    );

    expect(boardSizes).toEqual(new Set(["6x6", "6x8", "8x8"]));
    expect(vehicleCounts).toEqual(new Set([8, 11, 14]));
  });

  test("最低占有セルだけで盤面の3分の2を超える条件を供給探索から外すこと", () => {
    const conditions = listParkingJamReviewSupplyConditions(seed);
    const overCapacity = conditions.some((condition) => {
      const minimumOccupiedCellCount =
        condition.vehicleCount * 2 +
        condition.fixedAreaCount * condition.fixedAreaLength;
      return (
        minimumOccupiedCellCount * 3 > condition.width * condition.height * 2
      );
    });

    expect(overCapacity).toBe(false);
  });
});
