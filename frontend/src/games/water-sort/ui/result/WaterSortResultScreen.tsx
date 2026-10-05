import type { ReactNode } from "react";
import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createMoveCountMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import { getDifficultyLabel } from "@/games/difficulty";
import waterSortPictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { WATER_SORT_DISPLAY_NAME } from "@/games/water-sort/display-name";
import type { WaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import { WATER_SORT_SCORE_MAXIMUMS } from "@/games/water-sort/score";
import { getWaterSortScoreCriteria } from "@/games/water-sort/ui/result/WaterSortResultScreen/score-criteria";

type WaterSortResultScreenProps = {
  difficulty: WaterSortDifficulty;
  result: WaterSortResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function WaterSortResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: WaterSortResultScreenProps) {
  return (
    <GameResultScreen
      gameName={WATER_SORT_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={waterSortPictogramSvg}
      score={result.score.total}
      metrics={[
        createMoveCountMetric({
          moveCount: result.completionMoveCount,
          moveDelta: result.moveDelta,
        }),
        createElapsedTimeMetric(result),
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(result.score, WATER_SORT_SCORE_MAXIMUMS),
        createSpeedFullScoreMetric(result.speedRule),
        createCountMetric("総手数", result.moveCount, "手"),
        createCountMetric("手戻り", result.backtrackMoveCount, "手"),
        createOperationCountMetric("undo", result.undoCount),
        createOperationCountMetric("restart", result.restartCount),
      ]}
      scoreCriteria={getWaterSortScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
