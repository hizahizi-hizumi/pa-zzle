import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { restoreWaterSortProblem } from "@/games/water-sort/problem/generator";
import {
  isWaterSortProblemIdentity,
  type WaterSortGeneratedProblem,
  type WaterSortProblemIdentity,
} from "@/games/water-sort/problem/problem";

export type WaterSortDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "water-sort",
  WaterSortDifficulty,
  WaterSortProblemIdentity
>;

export function createWaterSortDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  buildRevision: string | null;
}): WaterSortDiagnosticSnapshot {
  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "water-sort",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    buildRevision,
  };
}

export function parseWaterSortDiagnosticSnapshot(
  serialized: string,
): WaterSortDiagnosticSnapshot {
  const value: unknown = JSON.parse(serialized);
  if (!isRecord(value)) {
    throw new TypeError("Water sort diagnostic snapshot must be an object");
  }

  const difficulty =
    typeof value.difficulty === "string"
      ? parseDifficultyLevel(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "water-sort" ||
    !difficulty ||
    !isWaterSortProblemIdentity(value.problemIdentity) ||
    !(typeof value.buildRevision === "string" || value.buildRevision === null)
  ) {
    throw new TypeError("Invalid water sort diagnostic snapshot");
  }

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "water-sort",
    difficulty,
    problemIdentity: value.problemIdentity,
    buildRevision: value.buildRevision,
  };
}

export function restoreWaterSortProblemFromDiagnosticSnapshot(
  snapshot: WaterSortDiagnosticSnapshot,
): WaterSortGeneratedProblem {
  return restoreWaterSortProblem(snapshot.problemIdentity);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
