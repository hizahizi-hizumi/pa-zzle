import {
  type InternalDiagnosticSnapshot,
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
} from "@/games/diagnostics";
import {
  parseWaterSortDifficulty,
  type WaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import { restoreWaterSortProblem } from "@/games/water-sort/problem/generator";
import {
  WATER_SORT_GENERATOR_VERSION,
  type WaterSortGeneratedProblem,
  type WaterSortProblemIdentity,
} from "@/games/water-sort/problem/problem";
import {
  WATER_SORT_BOTTLE_CAPACITY,
  WATER_SORT_EMPTY_BOTTLE_COUNT,
} from "@/games/water-sort/puzzle/state";

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
      ? parseWaterSortDifficulty(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "water-sort" ||
    !difficulty ||
    !isProblemIdentity(value.problemIdentity) ||
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

function isProblemIdentity(value: unknown): value is WaterSortProblemIdentity {
  if (!isRecord(value) || !isRecord(value.conditions)) {
    return false;
  }

  return (
    value.generatorVersion === WATER_SORT_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    Number.isInteger(value.conditions.colorCount) &&
    Number(value.conditions.colorCount) > 0 &&
    value.conditions.capacity === WATER_SORT_BOTTLE_CAPACITY &&
    value.conditions.emptyBottleCount === WATER_SORT_EMPTY_BOTTLE_COUNT &&
    Number.isInteger(value.generationAttempt) &&
    Number(value.generationAttempt) > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
