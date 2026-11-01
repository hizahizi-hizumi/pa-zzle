import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedTakuzuResult } from "@/game-catalog/takuzu/RecordedTakuzuResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import {
  isTakuzuPlayRecord,
  restoreTakuzuRecordedResult,
  takuzuPlayRecordDefinition,
} from "@/games/takuzu/play-record";
import {
  findTakuzuPoolProblemFeatures,
  listTakuzuPoolProblemIds,
  takuzuProblemFeatureAxes,
} from "@/games/takuzu/problem/problem-pool";
import { canSelectTakuzuProblemById } from "@/games/takuzu/problem-selection";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import {
  formatTakuzuProblemFeatures,
  takuzuProblemFeatureAxisDisplays,
} from "@/games/takuzu/ui/problem-features";

export const takuzuCatalogEntry = {
  id: takuzuPlayRecordDefinition.gameId,
  name: TAKUZU_DISPLAY_NAME,
  pictogramSvg,
  homePath: "/puzzles/takuzu",
  playPath: "/puzzles/takuzu/play/:difficulty",
  playRecordDisplay: takuzuPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isTakuzuPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectTakuzuProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectTakuzuProblemById,
    );
  },
  listPoolProblemIds: listTakuzuPoolProblemIds,
  renderRecordResult(record, context) {
    const recorded = restoreTakuzuRecordedResult(record);
    return recorded ? (
      <RecordedTakuzuResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findTakuzuPoolProblemFeatures(difficulty, problemId);
    return features ? formatTakuzuProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findTakuzuPoolProblemFeatures,
    takuzuProblemFeatureAxes,
    takuzuProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
