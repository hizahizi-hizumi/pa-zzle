import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { summarizeLevels } from "@/game-catalog/level-summary";
import { RecordedWaterSortResult } from "@/game-catalog/water-sort/RecordedWaterSortResult";
import { type NumericRange, parseDifficultyLevel } from "@/games/difficulty";
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

function toPercent(rate: number): number {
  return Math.round(rate * 100);
}

/** 目先の自然な手を選び続けたときに詰む割合（SPEC-009 の難易度）の範囲。 */
function formatStuckRate({
  minimum,
  maximum,
  excludesMinimum,
}: NumericRange): string {
  if (minimum === Number.NEGATIVE_INFINITY) {
    return `詰み${toPercent(maximum)}%以下`;
  }
  if (maximum === Number.POSITIVE_INFINITY) {
    return `詰み${toPercent(minimum)}%${excludesMinimum ? "超" : "以上"}`;
  }
  return `詰み${toPercent(minimum)}〜${toPercent(maximum)}%`;
}

export const waterSortCatalogEntry = {
  id: waterSortPlayRecordDefinition.gameId,
  name: WATER_SORT_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  homePath: "/puzzles/water-sort",
  playPath: "/puzzles/water-sort/play/:difficulty",
  playRecordDisplay: waterSortPlayRecordDisplay,
  levelSummaries: summarizeLevels((difficulty) =>
    formatStuckRate(waterSortDifficultyCriteria[difficulty].stuckRate),
  ),
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
