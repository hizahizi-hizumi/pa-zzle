import type { ParkingJamBoard } from "../puzzle/board";
import { _private, analyzeParkingJamDifficulty } from "./difficulty-analysis";
import { analyzeParkingJamSolvability } from "./generation/solvability";

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

      expect(analysis.status).toBe("supported");
      expect(analysis.features.dependencyDepth).toBe(1);
      expect(analysis.features.initialLegalVehicleCount).toBe(3);
      expect(analysis.features.legalOrderCount).toBe("6");
      expect(analysis.features.solutionOrderFreedom).toBe(1);
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
      expect(analysis.features.solutionOrderFreedom).toBeLessThan(1);
    });
  });
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
