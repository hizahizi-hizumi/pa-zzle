import {
  createGameReplay,
  type GameCatalogEntry,
  type RecordReplayStart,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableMinesweeper } from "@/game-catalog/minesweeper/PlayableMinesweeper";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { isMinesweeperPlayAttempt } from "@/games/minesweeper/play-attempt";
import {
  isMinesweeperPlayRecord,
  minesweeperPlayRecordDefinition,
} from "@/games/minesweeper/play-record";
import {
  type MinesweeperRestoredProblem,
  restoreMinesweeperProblemWithoutAnalysis,
} from "@/games/minesweeper/problem/generator";
import type { MinesweeperProblemIdentity } from "@/games/minesweeper/problem/problem";
import { minesweeperPlayAttemptDisplay } from "@/games/minesweeper/ui/play-attempt-display";
import { minesweeperPlayRecordDisplay } from "@/games/minesweeper/ui/play-record-display";
import { restoreProblemOrNull } from "@/games/problem-restoration";

/** 完了記録と試行に共通する開始条件。 */
type MinesweeperReplayConditions = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
};

type MinesweeperReplayStart = {
  difficulty: MinesweeperDifficulty;
  initialProblem: MinesweeperRestoredProblem;
};

function resolveMinesweeperReplayStart({
  difficulty,
  problemIdentity,
}: MinesweeperReplayConditions): RecordReplayStart<MinesweeperReplayStart> {
  const initialProblem = restoreProblemOrNull(() =>
    restoreMinesweeperProblemWithoutAnalysis(problemIdentity),
  );
  if (!initialProblem) {
    return unavailableRecordReplay("problem-not-restorable");
  }

  return { status: "available", start: { difficulty, initialProblem } };
}

export const minesweeperCatalogEntry = {
  id: minesweeperPlayRecordDefinition.gameId,
  name: "マインスイーパー",
  pictogramSvg,
  entryPath: "/puzzles/minesweeper",
  playRecordDisplay: minesweeperPlayRecordDisplay,
  playAttemptDisplay: minesweeperPlayAttemptDisplay,
  ...createGameReplay({
    readRecordConditions: (record) =>
      isMinesweeperPlayRecord(record) ? record.payload : null,
    readAttemptConditions: (attempt) =>
      isMinesweeperPlayAttempt(attempt) ? attempt.start : null,
    resolveStart: resolveMinesweeperReplayStart,
    renderPlay: (start) => <PlayableMinesweeper {...start} />,
  }),
} satisfies GameCatalogEntry;

export const _private = { resolveMinesweeperReplayStart };
