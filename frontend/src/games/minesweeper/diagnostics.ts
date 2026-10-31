import {
  createInternalDiagnosticSnapshot,
  type InternalDiagnosticFormat,
  type InternalDiagnosticSnapshot,
  parseInternalDiagnosticSnapshot,
} from "@/games/diagnostics";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { restoreMinesweeperProblemWithoutAnalysis } from "@/games/minesweeper/problem/generator";
import {
  isMinesweeperProblemIdentity,
  type MinesweeperIdentifiedProblem,
  type MinesweeperProblemIdentity,
} from "@/games/minesweeper/problem/problem";

export type MinesweeperDiagnosticSnapshot = InternalDiagnosticSnapshot<
  "minesweeper",
  MinesweeperDifficulty,
  MinesweeperProblemIdentity
>;

const minesweeperDiagnosticFormat: InternalDiagnosticFormat<MinesweeperDiagnosticSnapshot> =
  {
    game: "minesweeper",
    parseDifficulty: parseDifficultyLevel,
    isProblemIdentity: isMinesweeperProblemIdentity,
  };

export function createMinesweeperDiagnosticSnapshot(input: {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  buildRevision: string | null;
}): MinesweeperDiagnosticSnapshot {
  return createInternalDiagnosticSnapshot(minesweeperDiagnosticFormat, input);
}

function parseMinesweeperDiagnosticSnapshot(
  serialized: string,
): MinesweeperDiagnosticSnapshot {
  return parseInternalDiagnosticSnapshot(
    serialized,
    minesweeperDiagnosticFormat,
  );
}

function restoreMinesweeperProblemFromDiagnosticSnapshot(
  snapshot: MinesweeperDiagnosticSnapshot,
): MinesweeperIdentifiedProblem {
  return restoreMinesweeperProblemWithoutAnalysis(snapshot.problemIdentity);
}

export const _private = {
  parseMinesweeperDiagnosticSnapshot,
  restoreMinesweeperProblemFromDiagnosticSnapshot,
};
