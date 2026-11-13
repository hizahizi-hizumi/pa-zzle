import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedTsumeShogiResult } from "@/game-catalog/tsume-shogi/RecordedTsumeShogiResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/tsume-shogi/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/tsume-shogi/assets/pictogram-showcase.svg?raw";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import {
  isTsumeShogiPlayRecord,
  restoreTsumeShogiRecordedResult,
  tsumeShogiPlayRecordDefinition,
} from "@/games/tsume-shogi/play-record";
import {
  findTsumeShogiPoolProblemFeatures,
  listTsumeShogiPoolProblemIds,
  tsumeShogiProblemFeatureAxes,
} from "@/games/tsume-shogi/problem/problem-pool";
import { canSelectTsumeShogiProblemById } from "@/games/tsume-shogi/problem-selection";
import { tsumeShogiPlayRecordDisplay } from "@/games/tsume-shogi/ui/play-record-display";
import {
  formatTsumeShogiProblemFeatures,
  tsumeShogiProblemFeatureAxisDisplays,
} from "@/games/tsume-shogi/ui/problem-features";

export const tsumeShogiCatalogEntry = {
  id: tsumeShogiPlayRecordDefinition.gameId,
  name: TSUME_SHOGI_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  homePath: "/puzzles/tsume-shogi",
  playPath: "/puzzles/tsume-shogi/play/:difficulty",
  playRecordDisplay: tsumeShogiPlayRecordDisplay,
  // 難易度の定義に遊ぶ人が一目で分かる数が無いので、問題集の中身を短く言い表す。
  levelSummaries: {
    "1": "3手詰",
    "2": "3・5手詰",
    "3": "5手詰",
    "4": "5手詰",
    "5": "5手詰",
  },
  recordProblemPlayTarget(record) {
    return isTsumeShogiPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectTsumeShogiProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectTsumeShogiProblemById,
    );
  },
  listPoolProblemIds: listTsumeShogiPoolProblemIds,
  hasRecordResult(record) {
    return restoreTsumeShogiRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreTsumeShogiRecordedResult(record);
    return recorded ? (
      <RecordedTsumeShogiResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findTsumeShogiPoolProblemFeatures(difficulty, problemId);
    return features ? formatTsumeShogiProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findTsumeShogiPoolProblemFeatures,
    tsumeShogiProblemFeatureAxes,
    tsumeShogiProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
