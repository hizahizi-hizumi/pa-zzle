import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedMinesweeperResult } from "@/game-catalog/minesweeper/RecordedMinesweeperResult";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import { parseMinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import {
  isMinesweeperPlayRecord,
  minesweeperPlayRecordDefinition,
  restoreMinesweeperRecordedResult,
} from "@/games/minesweeper/play-record";
import { canSelectMinesweeperProblemById } from "@/games/minesweeper/problem-selection";
import { minesweeperPlayRecordDisplay } from "@/games/minesweeper/ui/play-record-display";

export const minesweeperCatalogEntry = {
  id: minesweeperPlayRecordDefinition.gameId,
  name: "マインスイーパー",
  pictogramSvg,
  entryPath: "/puzzles/minesweeper",
  playPath: "/puzzles/minesweeper/play/:difficulty",
  playRecordDisplay: minesweeperPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isMinesweeperPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseMinesweeperDifficulty(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectMinesweeperProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseMinesweeperDifficulty(start.difficulty),
      start.problemIdentity,
      canSelectMinesweeperProblemById,
    );
  },
  renderRecordResult(record, context) {
    const recorded = restoreMinesweeperRecordedResult(record);
    return recorded ? (
      <RecordedMinesweeperResult {...recorded} {...context} />
    ) : null;
  },
} satisfies GameCatalogEntry;
