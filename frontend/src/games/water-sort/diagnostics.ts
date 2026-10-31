import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import {
  restoreWaterSortProblem,
  type WaterSortGeneratedProblem,
} from "@/games/water-sort/problem/generator";
import {
  isWaterSortProblemIdentity,
  type WaterSortProblemIdentity,
} from "@/games/water-sort/problem/problem";

export type WaterSortDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "water-sort",
  WaterSortDifficulty,
  WaterSortProblemIdentity
>;

const waterSortDiagnosticFormat: InternalDiagnosticFormat<WaterSortDiagnosticSnapshot> =
  {
    game: "water-sort",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isWaterSortProblemIdentity,
  };

export function createWaterSortDiagnosticSnapshot(input: {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  buildRevision: string | null;
}): WaterSortDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(waterSortDiagnosticFormat, input);
}

function parseWaterSortDiagnosticSnapshot(
  serialized: string,
): WaterSortDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(serialized, waterSortDiagnosticFormat);
}

function restoreWaterSortProblemFromDiagnosticSnapshot(
  snapshot: WaterSortDiagnosticSnapshot,
): WaterSortGeneratedProblem {
  return restoreWaterSortProblem(snapshot.problemIdentity);
}

export const _private = {
  parseWaterSortDiagnosticSnapshot,
  restoreWaterSortProblemFromDiagnosticSnapshot,
};
