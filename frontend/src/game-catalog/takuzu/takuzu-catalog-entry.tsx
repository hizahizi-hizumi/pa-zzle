import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedTakuzuResult } from "@/game-catalog/takuzu/RecordedTakuzuResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/takuzu/assets/pictogram-showcase.svg?raw";
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
  pictogramShowcaseSvg,
  homePath: "/puzzles/takuzu",
  playPath: "/puzzles/takuzu/play/:difficulty",
  playRecordDisplay: takuzuPlayRecordDisplay,
  // 難易度の定義に、レベルの違いを表す数が無いので、違いを文言で書く。
  levelSummaries: {
    "1": "3連禁止",
    "2": "個数の一致",
    "3": "残り1つ",
    "4": "同じ列禁止",
    "5": "合わせ技",
  },
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
  hasRecordResult(record) {
    return restoreTakuzuRecordedResult(record) !== null;
  },
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
