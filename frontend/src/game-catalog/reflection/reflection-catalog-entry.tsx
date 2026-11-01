import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedReflectionResult } from "@/game-catalog/reflection/RecordedReflectionResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  isReflectionPlayRecord,
  reflectionPlayRecordDefinition,
  restoreReflectionRecordedResult,
} from "@/games/reflection/play-record";
import {
  findReflectionPoolProblemFeatures,
  listReflectionPoolProblemIds,
  reflectionProblemFeatureAxes,
} from "@/games/reflection/problem/problem-pool";
import { canSelectReflectionProblemById } from "@/games/reflection/problem-selection";
import { reflectionPlayRecordDisplay } from "@/games/reflection/ui/play-record-display";
import {
  formatReflectionProblemFeatures,
  reflectionProblemFeatureAxisDisplays,
} from "@/games/reflection/ui/problem-features";

export const reflectionCatalogEntry = {
  id: reflectionPlayRecordDefinition.gameId,
  name: REFLECTION_DISPLAY_NAME,
  pictogramSvg,
  homePath: "/puzzles/reflection",
  playPath: "/puzzles/reflection/play/:difficulty",
  playRecordDisplay: reflectionPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isReflectionPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectReflectionProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectReflectionProblemById,
    );
  },
  listPoolProblemIds: listReflectionPoolProblemIds,
  renderRecordResult(record, context) {
    const recorded = restoreReflectionRecordedResult(record);
    return recorded ? (
      <RecordedReflectionResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findReflectionPoolProblemFeatures(difficulty, problemId);
    return features ? formatReflectionProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findReflectionPoolProblemFeatures,
    reflectionProblemFeatureAxes,
    reflectionProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
