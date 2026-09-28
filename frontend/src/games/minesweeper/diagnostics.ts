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
  isMinesweeperProblemIdentity,
  type MinesweeperProblemIdentity,
} from "@/games/minesweeper/problem/problem";

export type MinesweeperDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "minesweeper",
  MinesweeperDifficulty,
  MinesweeperProblemIdentity
>;

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
    !isMinesweeperProblemIdentity(value.problemIdentity) ||
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
