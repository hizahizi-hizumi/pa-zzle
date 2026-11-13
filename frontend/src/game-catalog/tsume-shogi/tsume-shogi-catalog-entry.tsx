import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import {
  type LevelSummaries,
  summarizeLevelsDistinctly,
} from "@/game-catalog/level-summary";
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
  listTsumeShogiPoolSeeds,
  parseTsumeShogiPoolSeed,
  tsumeShogiProblemFeatureAxes,
} from "@/games/tsume-shogi/problem/problem-pool";
import { canSelectTsumeShogiProblemById } from "@/games/tsume-shogi/problem-selection";
import { tsumeShogiPlayRecordDisplay } from "@/games/tsume-shogi/ui/play-record-display";
import {
  formatTsumeShogiProblemFeatures,
  tsumeShogiProblemFeatureAxisDisplays,
} from "@/games/tsume-shogi/ui/problem-features";

const tsumeShogiLevelDecoySummaries = {
  "1": "ひっかけなし",
  "2": "ひっかけ少し",
  "3": "ひっかけあり",
  "4": "ひっかけ多め",
  "5": "ひっかけだらけ",
} as const satisfies LevelSummaries;

export const tsumeShogiCatalogEntry = {
  id: tsumeShogiPlayRecordDefinition.gameId,
  name: TSUME_SHOGI_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  homePath: "/puzzles/tsume-shogi",
  playPath: "/puzzles/tsume-shogi/play/:difficulty",
  playRecordDisplay: tsumeShogiPlayRecordDisplay,
  levelSummaries: summarizeLevelsDistinctly(
    (difficulty) =>
      `${[
        ...new Set(
          listTsumeShogiPoolSeeds(difficulty).map(
            (seed) => parseTsumeShogiPoolSeed(seed).conditions.plies,
          ),
        ),
      ]
        .sort((left, right) => left - right)
        .join("・")}手詰`,
    (difficulty) => tsumeShogiLevelDecoySummaries[difficulty],
  ),
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
