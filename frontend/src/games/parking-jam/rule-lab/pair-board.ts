import type { ParkingJamBoard } from "@/games/parking-jam/puzzle/board";

export const pairBoard = {
  width: 7,
  height: 7,
  vehicles: [
    {
      id: "v0",
      row: 2,
      column: 2,
      orientation: "vertical",
      length: 3,
    },
    {
      id: "v1",
      row: 2,
      column: 4,
      orientation: "horizontal",
      length: 2,
    },
    {
      id: "v2",
      row: 1,
      column: 6,
      orientation: "vertical",
      length: 3,
    },
    {
      id: "v3",
      row: 5,
      column: 4,
      orientation: "vertical",
      length: 2,
    },
    {
      id: "v4",
      row: 5,
      column: 0,
      orientation: "horizontal",
      length: 3,
    },
    {
      id: "v5",
      row: 6,
      column: 0,
      orientation: "horizontal",
      length: 2,
    },
    {
      id: "v6",
      row: 1,
      column: 2,
      orientation: "horizontal",
      length: 2,
    },
    {
      id: "v7",
      row: 0,
      column: 0,
      orientation: "vertical",
      length: 2,
    },
  ],
  fixedAreas: [],
  roadOpenings: [
    {
      side: "up",
      startOffset: 0,
      length: 7,
    },
    {
      side: "right",
      startOffset: 0,
      length: 7,
    },
    {
      side: "down",
      startOffset: 0,
      length: 7,
    },
    {
      side: "left",
      startOffset: 0,
      length: 7,
    },
  ],
} satisfies ParkingJamBoard;
