import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { FukumenzanDifficulty } from "@/games/fukumenzan/difficulty";
import { FUKUMENZAN_DISPLAY_NAME } from "@/games/fukumenzan/display-name";
import type { FukumenzanResult } from "@/games/fukumenzan/play/use-fukumenzan-play";
import { FUKUMENZAN_SCORE_MAXIMUMS } from "@/games/fukumenzan/score";
import { getFukumenzanScoreCriteria } from "@/games/fukumenzan/ui/result/FukumenzanResultScreen/score-criteria";
import type { GamePlayResultScreenProps } from "@/games/play";

type FukumenzanResultScreenProps = GamePlayResultScreenProps<
  FukumenzanDifficulty,
  FukumenzanResult
>;

/** 内訳はこのプレイの点と、点に入らない操作の回数だけにする。 */
function listScoreBreakdown(result: FukumenzanResult) {
  return [
    ...listScoreBreakdownMetrics(result.score, FUKUMENZAN_SCORE_MAXIMUMS),
    createOperationCountMetric("undo", result.undoCount),
    createOperationCountMetric("restart", result.restartCount),
  ];
}

export function FukumenzanResultScreen({
  difficulty,
  result,
  recordFeedback,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onOpenDiagnostics,
}: FukumenzanResultScreenProps) {
  return (
    <GameResultScreen
      gameName={FUKUMENZAN_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      // 点は速さだけなので、主な成績は点を決める時間と基準時間だけにする。
      metrics={[
        createElapsedTimeMetric(result),
        createSpeedFullScoreMetric(result.speedRule),
      ]}
      score={result.score.total}
      scoreBreakdown={listScoreBreakdown(result)}
      scoreCriteria={getFukumenzanScoreCriteria(result)}
      recordFeedback={recordFeedback}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenGameHome={onOpenGameHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
