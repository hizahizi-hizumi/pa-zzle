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
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { HAKOIRI_MUSUME_DISPLAY_NAME } from "@/games/hakoiri-musume/display-name";
import type { HakoiriMusumeResult } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import { HAKOIRI_MUSUME_SCORE_MAXIMUMS } from "@/games/hakoiri-musume/score";
import { getHakoiriMusumeScoreCriteria } from "@/games/hakoiri-musume/ui/result/HakoiriMusumeResultScreen/score-criteria";
import type { GamePlayResultScreenProps } from "@/games/play";

type HakoiriMusumeResultScreenProps = GamePlayResultScreenProps<
  HakoiriMusumeDifficulty,
  HakoiriMusumeResult
>;

/** 最短手数は、手数の行の「最短との差」と内訳で示す。 */
export function HakoiriMusumeResultScreen({
  difficulty,
  result,
  recordFeedback,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onOpenDiagnostics,
}: HakoiriMusumeResultScreenProps) {
  return (
    <GameResultScreen
      gameName={HAKOIRI_MUSUME_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      score={result.score.total}
      metrics={[createMoveCountMetric(result), createElapsedTimeMetric(result)]}
      recordFeedback={recordFeedback}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(
          result.score,
          HAKOIRI_MUSUME_SCORE_MAXIMUMS,
        ),
        createCountMetric("最短手数", result.optimalMoveCount, "手"),
        createSpeedFullScoreMetric(result.speedRule),
        ...(result.completionMoveCount === null
          ? []
          : [
              createCountMetric(
                "完成時の手数",
                result.completionMoveCount,
                "手",
              ),
            ]),
        createOperationCountMetric("undo", result.undoCount),
        createOperationCountMetric("restart", result.restartCount),
      ]}
      scoreCriteria={getHakoiriMusumeScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenGameHome={onOpenGameHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
