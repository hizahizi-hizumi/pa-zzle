import {
  type GameCatalogEntry,
  type RecordReplayStart,
  renderRecordReplay,
  unavailableRecordReplay,
} from "@/game-catalog/game-catalog-entry";
import { PlayableMinesweeper } from "@/game-catalog/minesweeper/PlayableMinesweeper";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import {
  isMinesweeperPlayRecord,
  minesweeperPlayRecordDefinition,
} from "@/games/minesweeper/play-record";
import {
  type MinesweeperRestoredProblem,
  restoreMinesweeperProblemWithoutAnalysis,
} from "@/games/minesweeper/problem/generator";
import { minesweeperPlayAttemptDisplay } from "@/games/minesweeper/ui/play-attempt-display";
import { minesweeperPlayRecordDisplay } from "@/games/minesweeper/ui/play-record-display";
import { restoreProblemOrNull } from "@/games/problem-restoration";
import type { PlayRecord } from "@/records/play-record";

type MinesweeperReplayStart = {
  difficulty: MinesweeperDifficulty;
  initialProblem: MinesweeperRestoredProblem;
};

function resolveMinesweeperReplayStart(
  record: PlayRecord,
): RecordReplayStart<MinesweeperReplayStart> {
  if (!isMinesweeperPlayRecord(record)) {
    return unavailableRecordReplay("unsupported-record");
  }

  const { difficulty, problemIdentity } = record.payload;
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
  replayRecord(record) {
    return renderRecordReplay(
      resolveMinesweeperReplayStart(record),
      (start) => <PlayableMinesweeper {...start} />,
    );
  },
} satisfies GameCatalogEntry;

export const _private = { resolveMinesweeperReplayStart };
