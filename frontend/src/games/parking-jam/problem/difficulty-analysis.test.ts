import {
  _private,
  analyzeParkingJamDifficulty,
} from "@/games/parking-jam/problem/difficulty-analysis";
import { analyzeParkingJamSolvability } from "@/games/parking-jam/problem/generation/solvability";
import type { ParkingJamBoard } from "@/games/parking-jam/puzzle/board";

describe("analyzeParkingJamDifficulty", () => {
  describe("全車を最初から任意順で出庫できる盤面の場合", () => {
    const board: ParkingJamBoard = {
      width: 5,
      height: 5,
      vehicles: [
        { id: "a", row: 0, column: 1, orientation: "horizontal", length: 2 },
        { id: "b", row: 2, column: 1, orientation: "horizontal", length: 2 },
        { id: "c", row: 4, column: 1, orientation: "horizontal", length: 2 },
      ],
      fixedAreas: [],
      roadOpenings: [
        { side: "right", startOffset: 0, length: 1 },
        { side: "right", startOffset: 2, length: 1 },
        { side: "right", startOffset: 4, length: 1 },
      ],
    };
    const solvability = analyzeParkingJamSolvability(board);

    test("依存がなく解順自由度が最大になること", () => {
      const analysis = analyzeParkingJamDifficulty(board, solvability);

      expect(analysis.status).toBe("analyzed");
      expect(analysis.features.vehicleCount).toBe(3);
      expect(analysis.features.dependencyDepth).toBe(1);
      expect(analysis.features.initialLegalVehicleCount).toBe(3);
      expect(analysis.features.initialAverageMinimumBlockingVehicleCount).toBe(
        0,
      );
      expect(analysis.features.legalOrderCount).toBe("6");
      expect(analysis.features.solutionOrderFreedom).toBe(1);
      expect(analysis.features.reachableStateCount).toBe(8);
      expect(analysis.features.averageLegalVehicleCount).toBeCloseTo(12 / 7);
      expect(analysis.features.forcedChoiceStateRatio).toBe(0);
      expect(analysis.features.maximumForcedChoiceChainLength).toBe(0);
      expect(analysis.features.averageMinimumBlockingVehicleCount).toBe(0);
      expect(analysis.features.requiredPrecedenceCount).toBe(0);
      expect(analysis.features.maximumRequiredPredecessorCount).toBe(0);
      expect(analysis.features.averageNewlyUnlockedVehicleCount).toBe(0);
      expect(analysis.features.maximumPrerequisiteVehicleCount).toBe(0);
      expect(analysis.features.boardCellCount).toBe(25);
      expect(analysis.features.fixedAreaCount).toBe(0);
    });
  });

  describe("直列の遮断依存を持つ盤面の場合", () => {
    const board: ParkingJamBoard = {
      width: 6,
      height: 6,
      vehicles: [
        { id: "a", row: 3, column: 0, orientation: "horizontal", length: 2 },
        { id: "b", row: 2, column: 2, orientation: "vertical", length: 2 },
        { id: "c", row: 1, column: 2, orientation: "horizontal", length: 2 },
      ],
      fixedAreas: [],
      roadOpenings: [
        { side: "right", startOffset: 3, length: 1 },
        { side: "up", startOffset: 2, length: 1 },
        { side: "right", startOffset: 1, length: 1 },
      ],
    };
    const solvability = analyzeParkingJamSolvability(board);

    test("依存の深さと遮断量を取得すること", () => {
      const analysis = analyzeParkingJamDifficulty(board, solvability);

      expect(analysis.features.dependencyDepth).toBeGreaterThan(1);
      expect(analysis.features.vehicleBlockingEdgeCount).toBeGreaterThan(0);
      expect(analysis.features.initialLegalVehicleRatio).toBeLessThan(1);
      expect(
        analysis.features.initialAverageMinimumBlockingVehicleCount,
      ).toBeGreaterThan(0);
      expect(analysis.features.solutionOrderFreedom).toBeLessThan(1);
      expect(analysis.features.reachableStateCount).toBe(4);
      expect(analysis.features.minimumLegalVehicleRatio).toBeCloseTo(1 / 3);
      expect(analysis.features.averageLegalVehicleCount).toBe(1);
      expect(analysis.features.forcedChoiceStateRatio).toBe(1);
      expect(analysis.features.maximumForcedChoiceChainLength).toBe(2);
      expect(
        analysis.features.averageMinimumBlockingVehicleCount,
      ).toBeGreaterThan(0);
      expect(analysis.features.requiredPrecedenceCount).toBe(3);
      expect(analysis.features.maximumRequiredPredecessorCount).toBe(2);
      expect(analysis.features.averageNewlyUnlockedVehicleCount).toBeCloseTo(
        2 / 3,
      );
      expect(analysis.features.maximumNewlyUnlockedVehicleCount).toBe(1);
      expect(analysis.features.maximumPrerequisiteVehicleCount).toBe(2);
    });
  });
});

describe("analyzeParkingJamDifficulty", () => {
  const misreadCases = [
    [
      "開口のない側が隣の車線の開口に接する車",
      {
        width: 4,
        height: 4,
        vehicles: [
          { id: "a", row: 1, column: 0, orientation: "horizontal", length: 2 },
        ],
        fixedAreas: [],
        roadOpenings: [
          { side: "left", startOffset: 1, length: 1 },
          { side: "right", startOffset: 0, length: 1 },
        ],
      },
      {
        adjacentLaneOpeningVehicleCount: 1,
        directionChoiceVehicleCount: 0,
        farBlockedVehicleCount: 0,
        misreadInducingVehicleCount: 1,
      },
    ],
    [
      "両側に開口があり片側だけ塞がれた車",
      {
        width: 5,
        height: 4,
        vehicles: [
          { id: "b", row: 1, column: 2, orientation: "vertical", length: 2 },
          { id: "c", row: 0, column: 1, orientation: "horizontal", length: 2 },
        ],
        fixedAreas: [],
        roadOpenings: [
          { side: "up", startOffset: 2, length: 1 },
          { side: "down", startOffset: 2, length: 1 },
          { side: "left", startOffset: 0, length: 1 },
        ],
      },
      {
        adjacentLaneOpeningVehicleCount: 0,
        directionChoiceVehicleCount: 1,
        farBlockedVehicleCount: 0,
        misreadInducingVehicleCount: 1,
      },
    ],
    [
      "最初の遮断車が2マス以上先にある車",
      {
        width: 5,
        height: 3,
        vehicles: [
          { id: "d", row: 1, column: 0, orientation: "horizontal", length: 2 },
          { id: "e", row: 0, column: 4, orientation: "vertical", length: 2 },
        ],
        fixedAreas: [],
        roadOpenings: [
          { side: "right", startOffset: 1, length: 1 },
          { side: "up", startOffset: 4, length: 1 },
        ],
      },
      {
        adjacentLaneOpeningVehicleCount: 0,
        directionChoiceVehicleCount: 0,
        farBlockedVehicleCount: 1,
        misreadInducingVehicleCount: 1,
      },
    ],
  ] as const satisfies readonly (readonly [
    string,
    ParkingJamBoard,
    Record<string, number>,
  ])[];

  test.each(misreadCases)(
    "読み違いを誘う車を種類ごとに数え合計も求めること: %s",
    (_label, board, expected) => {
      const analysis = analyzeParkingJamDifficulty(
        board,
        analyzeParkingJamSolvability(board),
      );

      expect(analysis.features).toMatchObject(expected);
    },
  );
});

describe("_private.countLegalVehicleOrders", () => {
  const board: ParkingJamBoard = {
    width: 5,
    height: 5,
    vehicles: [
      { id: "a", row: 0, column: 1, orientation: "horizontal", length: 2 },
      { id: "b", row: 2, column: 1, orientation: "horizontal", length: 2 },
    ],
    fixedAreas: [],
    roadOpenings: [
      { side: "right", startOffset: 0, length: 1 },
      { side: "right", startOffset: 2, length: 1 },
    ],
  };

  test("車両順序の総数を重複なく数えること", () => {
    const count = _private.countLegalVehicleOrders(board);

    expect(count).toBe(2n);
  });
});
