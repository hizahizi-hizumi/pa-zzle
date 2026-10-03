import {
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedWaterSortResult } from "@/game-catalog/water-sort/RecordedWaterSortResult";
import pictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import { parseWaterSortDifficulty } from "@/games/water-sort/difficulty";
import {
  isWaterSortPlayRecord,
  restoreWaterSortRecordedResult,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import { canSelectWaterSortProblemById } from "@/games/water-sort/problem-selection";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";

export const waterSortCatalogEntry = {
  id: waterSortPlayRecordDefinition.gameId,
  name: "ウォーターソート",
  pictogramSvg,
  entryPath: "/puzzles/water-sort",
  playPath: "/puzzles/water-sort/play/:difficulty",
  playRecordDisplay: waterSortPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isWaterSortPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseWaterSortDifficulty(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectWaterSortProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseWaterSortDifficulty(start.difficulty),
      start.problemIdentity,
      canSelectWaterSortProblemById,
    );
  },
  renderRecordResult(record, context) {
    const recorded = restoreWaterSortRecordedResult(record);
    return recorded ? (
      <RecordedWaterSortResult {...recorded} {...context} />
    ) : null;
  },
} satisfies GameCatalogEntry;
