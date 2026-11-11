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
import {
  canSelectMinesweeperProblemById,
  selectMinesweeperProblemById,
} from "@/games/minesweeper/problem-selection";
import { MinesweeperGround } from "@/games/minesweeper/ui/MinesweeperGround";
import { MinesweeperProblemPreview } from "@/games/minesweeper/ui/MinesweeperProblemPreview";
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
  renderGround() {
    return <MinesweeperGround />;
  },
  homePath: "/puzzles/minesweeper",
  playPath: "/puzzles/minesweeper/play/:difficulty",
  playRecordDisplay: minesweeperPlayRecordDisplay,
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
  renderPoolProblemPreview(difficulty, problemId) {
    const selected = selectMinesweeperProblemById(difficulty, problemId);
    return selected ? (
      <MinesweeperProblemPreview problem={selected.problem} />
    ) : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findMinesweeperPoolProblemFeatures,
    minesweeperProblemFeatureAxes,
    minesweeperProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
