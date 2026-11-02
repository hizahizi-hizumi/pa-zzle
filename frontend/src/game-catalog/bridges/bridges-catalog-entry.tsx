import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import pictogramSvg from "@/games/bridges/assets/pictogram.svg?raw";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import { PLAY_SCORE_METRIC_ID } from "@/records/play-record-definition";
import {
  createPlayRecordDisplay,
  elapsedTimeProgressDisplay,
  playScoreMetricPresentation,
} from "@/records/ui/play-record-display";

const BRIDGES_GAME_ID = "bridges";

/**
 * 記録を持たないゲームの記録定義。どの記録もこのゲームの記録として読まず、評価点の指標も値を持たない。
 */
const bridgesPlayRecordDefinition = {
  gameId: BRIDGES_GAME_ID,
  isRecord: () => false,
  getComparisonKey: () => null,
  personalBestMetrics: [
    { id: PLAY_SCORE_METRIC_ID, direction: "higher", getValue: () => null },
  ],
  getClearPerformance: () => null,
} as const;

/**
 * ブリッジパズルの入口とプレイ画面。`gameCatalog` には載せず、パズル選択・記録・図鑑には出さない。
 * 入口とプレイ画面は URL で直接開ける。記録・問題集・結果画面を持たないので、遊び直し先・問題集の問題・記録の結果画面は返さない。
 */
export const bridgesCatalogEntry = {
  id: BRIDGES_GAME_ID,
  name: BRIDGES_DISPLAY_NAME,
  pictogramSvg,
  entryPath: "/puzzles/bridges",
  playPath: "/puzzles/bridges/play/:difficulty",
  playRecordDisplay: createPlayRecordDisplay({
    definition: bridgesPlayRecordDefinition,
    getComparisonLabel: () => null,
    metrics: { [PLAY_SCORE_METRIC_ID]: playScoreMetricPresentation },
    progress: { elapsedMs: elapsedTimeProgressDisplay },
  }),
  recordProblemPlayTarget: () => null,
  attemptProblemPlayTarget: () => null,
  listPoolProblemIds: () => [],
  describePoolProblem: () => null,
  problemFeatureFilter: { axes: [], findPoolProblemValues: () => null },
  renderRecordResult: () => null,
} satisfies GameCatalogEntry;
