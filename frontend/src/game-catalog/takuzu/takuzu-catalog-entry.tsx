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
import {
  canSelectTakuzuProblemById,
  selectTakuzuProblemById,
} from "@/games/takuzu/problem-selection";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import {
  formatTakuzuProblemFeatures,
  takuzuProblemFeatureAxisDisplays,
} from "@/games/takuzu/ui/problem-features";
import { TakuzuGround } from "@/games/takuzu/ui/TakuzuGround";
import { TakuzuProblemPreview } from "@/games/takuzu/ui/TakuzuProblemPreview";

export const takuzuCatalogEntry = {
  id: takuzuPlayRecordDefinition.gameId,
  name: TAKUZU_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  renderGround() {
    return <TakuzuGround />;
  },
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
  renderPoolProblemPreview(difficulty, problemId) {
    const pooled = selectTakuzuProblemById(difficulty, problemId);
    return pooled ? <TakuzuProblemPreview problem={pooled.problem} /> : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findTakuzuPoolProblemFeatures,
    takuzuProblemFeatureAxes,
    takuzuProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
