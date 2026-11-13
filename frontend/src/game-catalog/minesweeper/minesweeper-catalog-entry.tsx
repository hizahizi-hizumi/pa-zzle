import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import { RecordedMinesweeperResult } from "@/game-catalog/minesweeper/RecordedMinesweeperResult";
import { parseDifficultyLevel } from "@/games/difficulty";
import pictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/minesweeper/assets/pictogram-showcase.svg?raw";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import {
  isMinesweeperPlayRecord,
  minesweeperPlayRecordDefinition,
  restoreMinesweeperRecordedResult,
} from "@/games/minesweeper/play-record";
import {
  findMinesweeperPoolProblemFeatures,
  listMinesweeperPoolProblemIds,
  minesweeperProblemFeatureAxes,
} from "@/games/minesweeper/problem/problem-pool";
import { canSelectMinesweeperProblemById } from "@/games/minesweeper/problem-selection";
import { minesweeperPlayRecordDisplay } from "@/games/minesweeper/ui/play-record-display";
import {
  formatMinesweeperProblemFeatures,
  minesweeperProblemFeatureAxisDisplays,
} from "@/games/minesweeper/ui/problem-features";

export const minesweeperCatalogEntry = {
  id: minesweeperPlayRecordDefinition.gameId,
  name: MINESWEEPER_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  homePath: "/puzzles/minesweeper",
  playPath: "/puzzles/minesweeper/play/:difficulty",
  playRecordDisplay: minesweeperPlayRecordDisplay,
  // 難易度の定義に遊ぶ人が一目で分かる数が無いので、問題集の中身を短く言い表す。
  levelSummaries: {
    "1": "9〜13個",
    "2": "11〜18個",
    "3": "15〜23個",
    "4": "20〜34個",
    "5": "26〜38個",
  },
  recordProblemPlayTarget(record) {
    return isMinesweeperPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectMinesweeperProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectMinesweeperProblemById,
    );
  },
  listPoolProblemIds: listMinesweeperPoolProblemIds,
  hasRecordResult(record) {
    return restoreMinesweeperRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreMinesweeperRecordedResult(record);
    return recorded ? (
      <RecordedMinesweeperResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findMinesweeperPoolProblemFeatures(difficulty, problemId);
    return features ? formatMinesweeperProblemFeatures(features) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findMinesweeperPoolProblemFeatures,
    minesweeperProblemFeatureAxes,
    minesweeperProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
