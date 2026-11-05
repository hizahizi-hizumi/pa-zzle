import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedHakoiriMusumeResult } from "@/game-catalog/hakoiri-musume/RecordedHakoiriMusumeResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/hakoiri-musume/assets/pictogram.svg?raw";
import { HAKOIRI_MUSUME_DISPLAY_NAME } from "@/games/hakoiri-musume/display-name";
import {
  hakoiriMusumePlayRecordDefinition,
  isHakoiriMusumePlayRecord,
  restoreHakoiriMusumeRecordedResult,
} from "@/games/hakoiri-musume/play-record";
import { listHakoiriMusumePoolProblemIds } from "@/games/hakoiri-musume/problem/problem-pool";
import {
  findHakoiriMusumePoolProblemFeatures,
  hakoiriMusumeProblemFeatureAxes,
} from "@/games/hakoiri-musume/problem-features";
import { canSelectHakoiriMusumeProblemById } from "@/games/hakoiri-musume/problem-selection";
import { hakoiriMusumePlayRecordDisplay } from "@/games/hakoiri-musume/ui/play-record-display";
import {
  formatHakoiriMusumeProblemFeatures,
  hakoiriMusumeProblemFeatureAxisDisplays,
} from "@/games/hakoiri-musume/ui/problem-features";

export const hakoiriMusumeCatalogEntry = {
  id: hakoiriMusumePlayRecordDefinition.gameId,
  name: HAKOIRI_MUSUME_DISPLAY_NAME,
  pictogramSvg,
  homePath: "/puzzles/hakoiri-musume",
  playPath: "/puzzles/hakoiri-musume/play/:difficulty",
  playRecordDisplay: hakoiriMusumePlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isHakoiriMusumePlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectHakoiriMusumeProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectHakoiriMusumeProblemById,
    );
  },
  listPoolProblemIds: listHakoiriMusumePoolProblemIds,
  hasRecordResult(record) {
    return restoreHakoiriMusumeRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreHakoiriMusumeRecordedResult(record);
    return recorded ? (
      <RecordedHakoiriMusumeResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findHakoiriMusumePoolProblemFeatures(
      difficulty,
      problemId,
    );
    return features ? formatHakoiriMusumeProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findHakoiriMusumePoolProblemFeatures,
    hakoiriMusumeProblemFeatureAxes,
    hakoiriMusumeProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
