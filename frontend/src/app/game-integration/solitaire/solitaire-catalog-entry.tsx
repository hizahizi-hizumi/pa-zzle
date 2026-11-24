import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/app/game-integration/game-catalog-entry";
import { RecordedSolitaireResult } from "@/app/game-integration/solitaire/RecordedSolitaireResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/solitaire/assets/pictogram.svg?raw";
import { SOLITAIRE_DISPLAY_NAME } from "@/games/solitaire/display-name";
import {
  isSolitairePlayRecord,
  restoreSolitaireRecordedResult,
  solitairePlayRecordDefinition,
} from "@/games/solitaire/play-record";
import {
  findSolitairePoolProblemFeatures,
  listSolitairePoolProblemIds,
  solitaireProblemFeatureAxes,
} from "@/games/solitaire/problem/problem-pool";
import { canSelectSolitaireProblemById } from "@/games/solitaire/problem-selection";
import { solitairePlayRecordDisplay } from "@/games/solitaire/ui/play-record-display";
import {
  formatSolitaireProblemFeatures,
  solitaireProblemFeatureAxisDisplays,
} from "@/games/solitaire/ui/problem-features";

export const solitaireCatalogEntry = {
  id: solitairePlayRecordDefinition.gameId,
  name: SOLITAIRE_DISPLAY_NAME,
  pictogramSvg,
  homePath: "/puzzles/solitaire",
  playPath: "/puzzles/solitaire/play/:problemId",
  playRecordDisplay: solitairePlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isSolitairePlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectSolitaireProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectSolitaireProblemById,
    );
  },
  listPoolProblemIds: listSolitairePoolProblemIds,
  hasRecordResult(record) {
    return restoreSolitaireRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreSolitaireRecordedResult(record);
    return recorded ? (
      <RecordedSolitaireResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findSolitairePoolProblemFeatures(difficulty, problemId);
    return features ? formatSolitaireProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findSolitairePoolProblemFeatures,
    solitaireProblemFeatureAxes,
    solitaireProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
