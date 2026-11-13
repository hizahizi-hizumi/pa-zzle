import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedNanpureResult } from "@/game-catalog/nanpure/RecordedNanpureResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/nanpure/assets/pictogram-showcase.svg?raw";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import {
  isNanpurePlayRecord,
  nanpurePlayRecordDefinition,
  restoreNanpureRecordedResult,
} from "@/games/nanpure/play-record";
import {
  findNanpurePoolProblemFeatures,
  listNanpurePoolProblemIds,
  nanpureProblemFeatureAxes,
} from "@/games/nanpure/problem/problem-pool";
import { canSelectNanpureProblemById } from "@/games/nanpure/problem-selection";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import {
  formatNanpureProblemFeatures,
  nanpureProblemFeatureAxisDisplays,
} from "@/games/nanpure/ui/problem-features";

export const nanpureCatalogEntry = {
  id: nanpurePlayRecordDefinition.gameId,
  name: NANPURE_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  homePath: "/puzzles/nanpure",
  playPath: "/puzzles/nanpure/play/:difficulty",
  playRecordDisplay: nanpurePlayRecordDisplay,
  // 難易度の定義に、レベルの違いを表す数が無いので、違いを文言で書く。
  levelSummaries: {
    "1": "ヒント多め",
    "2": "基本の消去",
    "3": "候補を絞る",
    "4": "ペアを読む",
    "5": "上級の手筋",
  },
  recordProblemPlayTarget(record) {
    return isNanpurePlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectNanpureProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectNanpureProblemById,
    );
  },
  listPoolProblemIds: listNanpurePoolProblemIds,
  hasRecordResult(record) {
    return restoreNanpureRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreNanpureRecordedResult(record);
    return recorded ? (
      <RecordedNanpureResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findNanpurePoolProblemFeatures(difficulty, problemId);
    return features ? formatNanpureProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findNanpurePoolProblemFeatures,
    nanpureProblemFeatureAxes,
    nanpureProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
