import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import { MAGIC_SQUARE_DISPLAY_NAME } from "@/games/magic-square/display-name";
import type { MagicSquareResult } from "@/games/magic-square/play/use-magic-square-play";
import { MAGIC_SQUARE_SCORE_MAXIMUMS } from "@/games/magic-square/score";
import { getMagicSquareScoreCriteria } from "@/games/magic-square/ui/result/MagicSquareResultScreen/score-criteria";
import type { GamePlayResultScreenProps } from "@/games/play";

type MagicSquareResultScreenProps = GamePlayResultScreenProps<
  MagicSquareDifficulty,
  MagicSquareResult
>;

export function MagicSquareResultScreen({
  difficulty,
  result,
  recordFeedback,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onOpenDiagnostics,
}: MagicSquareResultScreenProps) {
  return (
    <GameResultScreen
      gameName={MAGIC_SQUARE_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      score={result.score.total}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric(
          "置き直し",
          result.correctionCount,
          "回",
          "correction-count",
        ),
      ]}
      recordFeedback={recordFeedback}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(result.score, MAGIC_SQUARE_SCORE_MAXIMUMS),
        createSpeedFullScoreMetric(result.speedRule),
        createCountMetric("空きマス", result.workload.emptyCellCount, "マス"),
        createOperationCountMetric("undo", result.undoCount),
        createOperationCountMetric("restart", result.restartCount),
      ]}
      scoreCriteria={getMagicSquareScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenGameHome={onOpenGameHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
