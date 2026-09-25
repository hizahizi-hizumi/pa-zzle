import {
  INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
  type InternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import {
  type MinesweeperDifficulty,
  parseMinesweeperDifficulty,
} from "@/games/minesweeper/difficulty";
import {
  type MinesweeperRestoredProblem,
  restoreMinesweeperProblemWithoutAnalysis,
} from "@/games/minesweeper/problem/generator";
import {
  MINESWEEPER_GENERATOR_VERSION,
  type MinesweeperProblemIdentity,
  type MinesweeperStartCellPlacement,
} from "@/games/minesweeper/problem/problem";

export type MinesweeperDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "minesweeper",
  MinesweeperDifficulty,
  MinesweeperProblemIdentity
>;

const startCellPlacements: readonly MinesweeperStartCellPlacement[] = [
  "random",
  "center",
];

export function createMinesweeperDiagnosticSnapshot({
  difficulty,
  problemIdentity,
  buildRevision,
}: {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  buildRevision: string | null;
}): MinesweeperDiagnosticSnapshot {
  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "minesweeper",
    difficulty,
    problemIdentity: {
      ...problemIdentity,
      conditions: { ...problemIdentity.conditions },
    },
    buildRevision,
  };
}

export function parseMinesweeperDiagnosticSnapshot(
  serialized: string,
): MinesweeperDiagnosticSnapshot {
  const value: unknown = JSON.parse(serialized);
  if (!isRecord(value)) {
    throw new TypeError("Minesweeper diagnostic snapshot must be an object");
  }

  const difficulty =
    typeof value.difficulty === "string"
      ? parseMinesweeperDifficulty(value.difficulty)
      : undefined;
  if (
    value.formatVersion !== INTERNAL_DIAGNOSTIC_FORMAT_VERSION ||
    value.game !== "minesweeper" ||
    !difficulty ||
    !isProblemIdentity(value.problemIdentity) ||
    !(typeof value.buildRevision === "string" || value.buildRevision === null)
  ) {
    throw new TypeError("Invalid minesweeper diagnostic snapshot");
  }

  return {
    formatVersion: INTERNAL_DIAGNOSTIC_FORMAT_VERSION,
    game: "minesweeper",
    difficulty,
    problemIdentity: value.problemIdentity,
    buildRevision: value.buildRevision,
  };
}

export function restoreMinesweeperProblemFromDiagnosticSnapshot(
  snapshot: MinesweeperDiagnosticSnapshot,
): MinesweeperRestoredProblem {
  return restoreMinesweeperProblemWithoutAnalysis(snapshot.problemIdentity);
}

function isPositiveInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) > 0;
}

function isProblemIdentity(
  value: unknown,
): value is MinesweeperProblemIdentity {
  if (!isRecord(value) || !isRecord(value.conditions)) {
    return false;
  }

  return (
    value.generatorVersion === MINESWEEPER_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    isPositiveInteger(value.conditions.rows) &&
    isPositiveInteger(value.conditions.columns) &&
    isPositiveInteger(value.conditions.mineCount) &&
    startCellPlacements.includes(
      value.conditions.startCellPlacement as MinesweeperStartCellPlacement,
    ) &&
    isPositiveInteger(value.generationAttempt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
