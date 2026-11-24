import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { GamePlayResultScreenProps } from "@/games/play";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import type { ShuttleParkingResult } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import { SHUTTLE_PARKING_SCORE_MAXIMUMS } from "@/games/shuttle-parking/score";
import { getShuttleParkingScoreCriteria } from "@/games/shuttle-parking/ui/result/ShuttleParkingResultScreen/score-criteria";

type ShuttleParkingResultScreenProps = GamePlayResultScreenProps<
  ShuttleParkingDifficulty,
  ShuttleParkingResult
>;

export function ShuttleParkingResultScreen({
  difficulty,
  result,
  recordFeedback,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onOpenDiagnostics,
}: ShuttleParkingResultScreenProps) {
  return (
    <GameResultScreen
      gameName={SHUTTLE_PARKING_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      score={result.score.total}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("罠", result.trapCount, "回", "trap-count"),
      ]}
      recordFeedback={recordFeedback}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(
          result.score,
          SHUTTLE_PARKING_SCORE_MAXIMUMS,
        ),
        createSpeedFullScoreMetric(result.speedRule),
        createCountMetric("車", result.speedReference.carCount, "台"),
        createCountMetric("乗客", result.speedReference.passengerCount, "人"),
        ...(result.speedReference.trapWeight > 0
          ? [
              createCountMetric(
                "先読み",
                result.speedReference.trapWeight,
                "人",
              ),
            ]
          : []),
        createOperationCountMetric("undo", result.undoCount),
        createOperationCountMetric("restart", result.restartCount),
      ]}
      scoreCriteria={getShuttleParkingScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenGameHome={onOpenGameHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
