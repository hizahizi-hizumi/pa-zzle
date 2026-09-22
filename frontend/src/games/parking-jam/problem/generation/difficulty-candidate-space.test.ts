import type { ParkingJamGenerationConditions } from "../problem";
import {
  generateParkingJamDifficultyCandidate,
  listParkingJamDifficultyCandidateConditions,
  PARKING_JAM_DIFFICULTY_CANDIDATE_AXES,
  PARKING_JAM_DIFFICULTY_CROSS_AXIS_CASES,
  type ParkingJamDifficultyCandidateAxis,
} from "./difficulty-candidate-space";

const conditionKeys = [
  "width",
  "height",
  "vehicleCount",
  "roadOpeningCount",
  "roadOpeningSpan",
  "fixedAreaCount",
  "fixedAreaLength",
  "blockingPlacementProbability",
] as const satisfies readonly (keyof ParkingJamGenerationConditions)[];

const expectedChangedKeysByAxis: Record<
  ParkingJamDifficultyCandidateAxis,
  readonly (keyof ParkingJamGenerationConditions)[]
> = {
  "board-size": ["width", "height"],
  "vehicle-count": ["vehicleCount"],
  "road-opening-count": ["roadOpeningCount"],
  "road-opening-span": ["roadOpeningSpan"],
  "fixed-area": ["fixedAreaCount", "fixedAreaLength"],
  "blocking-placement": ["blockingPlacementProbability"],
};

function changedConditionKeys(
  left: ParkingJamGenerationConditions,
  right: ParkingJamGenerationConditions,
): readonly (keyof ParkingJamGenerationConditions)[] {
  return conditionKeys.filter((key) => left[key] !== right[key]);
}

describe("listParkingJamDifficultyCandidateConditions", () => {
  const expectedCount =
    PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.boardSizes.length *
    PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.vehicleCounts.length *
    PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.roadOpeningCounts.length *
    PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.roadOpeningSpans.length *
    PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.fixedAreas.length *
    PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.blockingPlacementProbabilities.length;

  test("各生成軸の直積を難易度ラベルなしで列挙すること", () => {
    const conditions = listParkingJamDifficultyCandidateConditions();

    expect(conditions).toHaveLength(expectedCount);
    expect(expectedCount).toBe(216);
    expect(conditions.every((condition) => !("difficulty" in condition))).toBe(
      true,
    );
  });
});

describe("PARKING_JAM_DIFFICULTY_CROSS_AXIS_CASES", () => {
  const axes = [
    "board-size",
    "vehicle-count",
    "road-opening-count",
    "road-opening-span",
    "fixed-area",
    "blocking-placement",
  ] as const satisfies readonly ParkingJamDifficultyCandidateAxis[];

  test.each(axes)("%s だけを変えた比較ペアを持つこと", (axis) => {
    const [lower, higher] = PARKING_JAM_DIFFICULTY_CROSS_AXIS_CASES.filter(
      (candidate) => candidate.axis === axis,
    );

    const changedKeys = changedConditionKeys(
      lower?.conditions ?? ({} as ParkingJamGenerationConditions),
      higher?.conditions ?? ({} as ParkingJamGenerationConditions),
    );

    expect(lower?.variant).toBe("lower");
    expect(higher?.variant).toBe("higher");
    expect(changedKeys).toEqual(expectedChangedKeysByAxis[axis]);
  });

  test.each(PARKING_JAM_DIFFICULTY_CROSS_AXIS_CASES)(
    "$id を可解な候補問題として再現可能に生成すること",
    ({ seed, conditions }) => {
      const first = generateParkingJamDifficultyCandidate(seed, conditions);
      const second = generateParkingJamDifficultyCandidate(seed, conditions);

      expect(first).toEqual(second);
      expect(first.identity.conditions).toEqual(conditions);
      expect(first.solvabilityAnalysis.status).toBe("solvable");
    },
  );
});
