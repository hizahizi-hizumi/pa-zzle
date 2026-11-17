import type { ParkingJamBoard } from "@/games/parking-jam/puzzle/board";

export const largeRuleLabBoard = {
  width: 8,
  height: 8,
  vehicles: [
    { id: "v0", row: 1, column: 1, orientation: "horizontal", length: 3 },
    { id: "v1", row: 4, column: 6, orientation: "horizontal", length: 2 },
    { id: "v2", row: 4, column: 4, orientation: "horizontal", length: 2 },
    { id: "v3", row: 4, column: 1, orientation: "horizontal", length: 2 },
    { id: "v4", row: 2, column: 0, orientation: "vertical", length: 3 },
    { id: "v5", row: 1, column: 4, orientation: "horizontal", length: 3 },
    { id: "v6", row: 0, column: 0, orientation: "vertical", length: 2 },
    { id: "v7", row: 5, column: 0, orientation: "horizontal", length: 2 },
    { id: "v8", row: 1, column: 7, orientation: "vertical", length: 2 },
    { id: "v9", row: 0, column: 5, orientation: "horizontal", length: 3 },
    { id: "v10", row: 5, column: 5, orientation: "horizontal", length: 2 },
    { id: "v11", row: 5, column: 7, orientation: "vertical", length: 2 },
  ],
  fixedAreas: [],
  roadOpenings: [
    { side: "up", startOffset: 0, length: 8 },
    { side: "right", startOffset: 0, length: 8 },
    { side: "down", startOffset: 0, length: 8 },
    { side: "left", startOffset: 0, length: 8 },
  ],
} satisfies ParkingJamBoard;
