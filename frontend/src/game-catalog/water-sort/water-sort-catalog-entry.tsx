import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { formatRange, summarizeLevels } from "@/game-catalog/level-summary";
import { RecordedWaterSortResult } from "@/game-catalog/water-sort/RecordedWaterSortResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/water-sort/assets/pictogram-showcase.svg?raw";
import { waterSortDifficultyCriteria } from "@/games/water-sort/difficulty";
import { WATER_SORT_DISPLAY_NAME } from "@/games/water-sort/display-name";
import {
  isWaterSortPlayRecord,
  restoreWaterSortRecordedResult,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import {
  findWaterSortPoolProblemFeatures,
  listWaterSortPoolProblemIds,
  waterSortProblemFeatureAxes,
} from "@/games/water-sort/problem/problem-pool";
import { canSelectWaterSortProblemById } from "@/games/water-sort/problem-selection";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import {
  formatWaterSortProblemFeatures,
  waterSortProblemFeatureAxisDisplays,
} from "@/games/water-sort/ui/problem-features";

export const waterSortCatalogEntry = {
  id: waterSortPlayRecordDefinition.gameId,
  name: WATER_SORT_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  homePath: "/puzzles/water-sort",
  playPath: "/puzzles/water-sort/play/:difficulty",
  playRecordDisplay: waterSortPlayRecordDisplay,
  levelSummaries: summarizeLevels((difficulty) => {
    const colorCounts = waterSortDifficultyCriteria[
      difficulty
    ].generationProfiles.map(({ colorCount }) => colorCount);
    return formatRange(
      {
        minimum: Math.min(...colorCounts),
        maximum: Math.max(...colorCounts),
      },
      "色",
    );
  }),
  recordProblemPlayTarget(record) {
    return isWaterSortPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectWaterSortProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectWaterSortProblemById,
    );
  },
  listPoolProblemIds: listWaterSortPoolProblemIds,
  hasRecordResult(record) {
    return restoreWaterSortRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreWaterSortRecordedResult(record);
    return recorded ? (
      <RecordedWaterSortResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findWaterSortPoolProblemFeatures(difficulty, problemId);
    return features ? formatWaterSortProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findWaterSortPoolProblemFeatures,
    waterSortProblemFeatureAxes,
    waterSortProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
