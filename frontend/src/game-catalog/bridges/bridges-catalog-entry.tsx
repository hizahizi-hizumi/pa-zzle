import { RecordedBridgesResult } from "@/game-catalog/bridges/RecordedBridgesResult";
import {
  createProblemFeatureFilter,
  type GameCatalogEntry,
  resolveRecordProblemPlayTarget,
} from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/bridges/assets/pictogram.svg?raw";
import pictogramShowcaseSvg from "@/games/bridges/assets/pictogram-showcase.svg?raw";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import {
  bridgesPlayRecordDefinition,
  isBridgesPlayRecord,
  restoreBridgesRecordedResult,
} from "@/games/bridges/play-record";
import {
  bridgesProblemFeatureAxes,
  findBridgesPoolProblemFeatures,
  listBridgesPoolProblemIds,
} from "@/games/bridges/problem/problem-pool";
import {
  canSelectBridgesProblemById,
  selectBridgesProblemById,
} from "@/games/bridges/problem-selection";
import { BridgesGround } from "@/games/bridges/ui/BridgesGround";
import { BridgesProblemPreview } from "@/games/bridges/ui/BridgesProblemPreview";
import { bridgesPlayRecordDisplay } from "@/games/bridges/ui/play-record-display";
import {
  bridgesProblemFeatureAxisDisplays,
  formatBridgesProblemFeatures,
} from "@/games/bridges/ui/problem-features";
import { parseDifficultyLevel } from "@/games/difficulty";

export const bridgesCatalogEntry = {
  id: bridgesPlayRecordDefinition.gameId,
  name: BRIDGES_DISPLAY_NAME,
  pictogramSvg,
  pictogramShowcaseSvg,
  renderGround() {
    return <BridgesGround />;
  },
  homePath: "/puzzles/bridges",
  playPath: "/puzzles/bridges/play/:difficulty",
  playRecordDisplay: bridgesPlayRecordDisplay,
  recordProblemPlayTarget(record) {
    return isBridgesPlayRecord(record)
      ? resolveRecordProblemPlayTarget(
          parseDifficultyLevel(record.payload.difficulty),
          record.payload.problemIdentity,
          canSelectBridgesProblemById,
        )
      : null;
  },
  attemptProblemPlayTarget({ start }) {
    return resolveRecordProblemPlayTarget(
      parseDifficultyLevel(start.difficulty),
      start.problemIdentity,
      canSelectBridgesProblemById,
    );
  },
  listPoolProblemIds: listBridgesPoolProblemIds,
  hasRecordResult(record) {
    return restoreBridgesRecordedResult(record) !== null;
  },
  renderRecordResult(record, context) {
    const recorded = restoreBridgesRecordedResult(record);
    return recorded ? (
      <RecordedBridgesResult {...recorded} {...context} />
    ) : null;
  },
  describePoolProblem(difficulty, problemId) {
    const features = findBridgesPoolProblemFeatures(difficulty, problemId);
    return features ? formatBridgesProblemFeatures(features) : null;
  },
  renderPoolProblemPreview(difficulty, problemId) {
    const pooled = selectBridgesProblemById(difficulty, problemId);
    return pooled ? <BridgesProblemPreview problem={pooled.problem} /> : null;
  },
  problemFeatureFilter: createProblemFeatureFilter(
    findBridgesPoolProblemFeatures,
    bridgesProblemFeatureAxes,
    bridgesProblemFeatureAxisDisplays,
  ),
} satisfies GameCatalogEntry;
