import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import type { ParkingJamBoard } from "@/games/parking-jam/puzzle/board";

export type ParkingJamDifficultyPreviewProblem = {
  identity: ParkingJamProblemIdentity;
  board: ParkingJamBoard;
};

// 難易度選択を開くたびに生成・解析しないよう、通常供給で各難易度へ分類された
// 代表問題の盤面を識別情報とともに保持する。識別情報からの復元結果と判定は
// テストで照合する。
export const parkingJamDifficultyPreviewProblems = {
  easy: {
    identity: {
      generatorVersion: "2",
      seed: "parking-jam-preview-easy-6",
      conditions: {
        width: 6,
        height: 6,
        vehicleCount: 8,
        roadOpeningCount: 3,
        roadOpeningSpan: 2,
        fixedAreaCount: 0,
        fixedAreaLength: 1,
        blockingPlacementProbability: 0.5,
      },
      generationAttempt: 2,
    },
    board: {
      width: 6,
      height: 6,
      fixedAreas: [],
      roadOpenings: [
        { side: "down", startOffset: 3, length: 2 },
        { side: "up", startOffset: 4, length: 2 },
        { side: "up", startOffset: 1, length: 2 },
      ],
      vehicles: [
        { id: "v0", row: 1, column: 3, orientation: "vertical", length: 2 },
        { id: "v1", row: 3, column: 3, orientation: "vertical", length: 2 },
        { id: "v2", row: 0, column: 4, orientation: "vertical", length: 3 },
        { id: "v3", row: 2, column: 5, orientation: "vertical", length: 3 },
        { id: "v4", row: 0, column: 5, orientation: "vertical", length: 2 },
        { id: "v5", row: 1, column: 2, orientation: "vertical", length: 2 },
        { id: "v6", row: 3, column: 1, orientation: "vertical", length: 2 },
        { id: "v7", row: 3, column: 4, orientation: "vertical", length: 2 },
      ],
    },
  },
  normal: {
    identity: {
      generatorVersion: "2",
      seed: "parking-jam-preview-normal-28",
      conditions: {
        width: 8,
        height: 8,
        vehicleCount: 11,
        roadOpeningCount: 3,
        roadOpeningSpan: 3,
        fixedAreaCount: 0,
        fixedAreaLength: 1,
        blockingPlacementProbability: 0.5,
      },
      generationAttempt: 1,
    },
    board: {
      width: 8,
      height: 8,
      fixedAreas: [],
      roadOpenings: [
        { side: "left", startOffset: 0, length: 3 },
        { side: "up", startOffset: 4, length: 3 },
        { side: "right", startOffset: 3, length: 3 },
      ],
      vehicles: [
        { id: "v0", row: 4, column: 1, orientation: "horizontal", length: 3 },
        { id: "v1", row: 4, column: 4, orientation: "horizontal", length: 3 },
        { id: "v2", row: 2, column: 5, orientation: "horizontal", length: 2 },
        { id: "v3", row: 2, column: 2, orientation: "horizontal", length: 2 },
        { id: "v4", row: 2, column: 0, orientation: "horizontal", length: 2 },
        { id: "v5", row: 1, column: 1, orientation: "horizontal", length: 3 },
        { id: "v6", row: 0, column: 0, orientation: "horizontal", length: 3 },
        { id: "v7", row: 0, column: 5, orientation: "vertical", length: 2 },
        { id: "v8", row: 3, column: 2, orientation: "horizontal", length: 2 },
        { id: "v9", row: 3, column: 5, orientation: "horizontal", length: 2 },
        { id: "v10", row: 5, column: 6, orientation: "horizontal", length: 2 },
      ],
    },
  },
  hard: {
    identity: {
      generatorVersion: "2",
      seed: "parking-jam-preview-hard-35",
      conditions: {
        width: 8,
        height: 8,
        vehicleCount: 11,
        roadOpeningCount: 3,
        roadOpeningSpan: 2,
        fixedAreaCount: 1,
        fixedAreaLength: 2,
        blockingPlacementProbability: 1,
      },
      generationAttempt: 2,
    },
    board: {
      width: 8,
      height: 8,
      fixedAreas: [{ row: 5, column: 6, width: 1, height: 2 }],
      roadOpenings: [
        { side: "right", startOffset: 3, length: 2 },
        { side: "right", startOffset: 0, length: 2 },
        { side: "down", startOffset: 3, length: 2 },
      ],
      vehicles: [
        { id: "v0", row: 4, column: 3, orientation: "vertical", length: 3 },
        { id: "v1", row: 3, column: 0, orientation: "horizontal", length: 3 },
        { id: "v2", row: 3, column: 3, orientation: "horizontal", length: 2 },
        { id: "v3", row: 3, column: 5, orientation: "horizontal", length: 3 },
        { id: "v4", row: 4, column: 5, orientation: "horizontal", length: 3 },
        { id: "v5", row: 4, column: 4, orientation: "vertical", length: 3 },
        { id: "v6", row: 1, column: 2, orientation: "horizontal", length: 2 },
        { id: "v7", row: 1, column: 5, orientation: "horizontal", length: 2 },
        { id: "v8", row: 0, column: 0, orientation: "horizontal", length: 3 },
        { id: "v9", row: 0, column: 4, orientation: "horizontal", length: 2 },
        { id: "v10", row: 0, column: 6, orientation: "horizontal", length: 2 },
      ],
    },
  },
} as const satisfies Record<
  ParkingJamDifficulty,
  ParkingJamDifficultyPreviewProblem
>;
