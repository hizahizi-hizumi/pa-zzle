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
import takuzuPictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import type { TakuzuResult } from "@/games/takuzu/play/use-takuzu-play";
import { TAKUZU_SCORE_MAXIMUMS } from "@/games/takuzu/score";
import { getTakuzuScoreCriteria } from "@/games/takuzu/ui/result/TakuzuResultScreen/score-criteria";

type TakuzuResultScreenProps = GamePlayResultScreenProps<
  TakuzuDifficulty,
  TakuzuResult
>;

export function TakuzuResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TakuzuResultScreenProps) {
  return (
    <GameResultScreen
      gameName={TAKUZU_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={takuzuPictogramSvg}
      score={result.score.total}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("置き直し", result.correctionCount, "回"),
        createOperationCountMetric("undo", result.undoCount),
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(result.score, TAKUZU_SCORE_MAXIMUMS),
        createOperationCountMetric("restart", result.restartCount),
        createSpeedFullScoreMetric(result.speedRule),
        createCountMetric("空きマス", result.workload.emptyCellCount, "マス"),
        createCountMetric(
          "確定マスを探す局面",
          result.workload.roundCount,
          "回",
        ),
        createCountMetric(
          "行・列を読む局面",
          result.workload.lineReadingRoundCount,
          "回",
        ),
      ]}
      scoreCriteria={getTakuzuScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
