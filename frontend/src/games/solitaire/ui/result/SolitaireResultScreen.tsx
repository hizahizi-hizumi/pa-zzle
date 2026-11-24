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
import type { SolitaireDifficulty } from "@/games/solitaire/difficulty";
import { SOLITAIRE_DISPLAY_NAME } from "@/games/solitaire/display-name";
import type { SolitaireResult } from "@/games/solitaire/play/use-solitaire-play";
import { SOLITAIRE_SCORE_MAXIMUMS } from "@/games/solitaire/score";
import { getSolitaireScoreCriteria } from "@/games/solitaire/ui/result/SolitaireResultScreen/score-criteria";
import { SOLITAIRE_RETRACTED_MOVE_LABEL } from "@/games/solitaire/ui/score-vocabulary";

type SolitaireResultScreenProps = GamePlayResultScreenProps<
  SolitaireDifficulty,
  SolitaireResult
>;

/** 主な成績は、打った運びを取り消さなかったことと速さ。打った手の数は点に使わないので、内訳にだけ出す。 */
export function SolitaireResultScreen({
  difficulty,
  result,
  recordFeedback,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onOpenDiagnostics,
}: SolitaireResultScreenProps) {
  return (
    <GameResultScreen
      gameName={SOLITAIRE_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      score={result.score.total}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric(
          SOLITAIRE_RETRACTED_MOVE_LABEL,
          result.retractedMoveCount,
          "手",
        ),
      ]}
      recordFeedback={recordFeedback}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(result.score, SOLITAIRE_SCORE_MAXIMUMS),
        createSpeedFullScoreMetric(result.speedRule),
        createCountMetric("打った手", result.moveCount, "手"),
        createOperationCountMetric("undo", result.undoCount),
        createOperationCountMetric("restart", result.restartCount),
      ]}
      scoreCriteria={getSolitaireScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenGameHome={onOpenGameHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
