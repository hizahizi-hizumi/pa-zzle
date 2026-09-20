import type { ParkingJamBoard } from "../../puzzle/board";
import { analyzeParkingJamSolvability } from "./solvability";

describe("analyzeParkingJamSolvability", () => {
  describe("遮断関係を順に解消できる盤面の場合", () => {
    const board: ParkingJamBoard = {
      width: 5,
      height: 5,
      vehicles: [
        { id: "a", row: 2, column: 0, orientation: "horizontal", length: 2 },
        { id: "b", row: 1, column: 2, orientation: "vertical", length: 2 },
      ],
      fixedAreas: [],
      roadOpenings: [
        { side: "right", startOffset: 2, length: 1 },
        { side: "up", startOffset: 2, length: 1 },
      ],
    };

    test("依存層と解順を取得できること", () => {
      const analysis = analyzeParkingJamSolvability(board);

      expect(analysis.status).toBe("solvable");
      expect(analysis.removalLayers).toEqual([["b"], ["a"]]);
      expect(analysis.solution).toEqual([
        { vehicleId: "b", direction: "up" },
        { vehicleId: "a", direction: "right" },
      ]);
    });
  });

  describe("どの車も出庫できない盤面の場合", () => {
    const board: ParkingJamBoard = {
      width: 6,
      height: 4,
      vehicles: [
        { id: "a", row: 1, column: 1, orientation: "horizontal", length: 2 },
        { id: "b", row: 1, column: 3, orientation: "horizontal", length: 2 },
      ],
      fixedAreas: [
        { row: 1, column: 0, width: 1, height: 1 },
        { row: 1, column: 5, width: 1, height: 1 },
      ],
      roadOpenings: [
        { side: "right", startOffset: 1, length: 1 },
        { side: "left", startOffset: 1, length: 1 },
      ],
    };

    test("不可解として判定すること", () => {
      const analysis = analyzeParkingJamSolvability(board);

      expect(analysis.status).toBe("unsolvable");
    });
  });
});
