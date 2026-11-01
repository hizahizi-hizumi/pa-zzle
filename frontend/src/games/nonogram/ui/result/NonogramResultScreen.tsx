import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import { getDifficultyLabel } from "@/games/difficulty";
import nonogramPictogramSvg from "@/games/nonogram/assets/pictogram.svg?raw";
import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import { NONOGRAM_DISPLAY_NAME } from "@/games/nonogram/display-name";
import type { NonogramResult } from "@/games/nonogram/play/use-nonogram-play";
import { NONOGRAM_SCORE_MAXIMUMS } from "@/games/nonogram/score";
import { getNonogramScoreCriteria } from "@/games/nonogram/ui/result/NonogramResultScreen/score-criteria";
import type { GamePlayResultScreenProps } from "@/games/play";

type NonogramResultScreenProps = GamePlayResultScreenProps<
  NonogramDifficulty,
  NonogramResult
>;

/** 主な成績は評価に使う時間と塗り直しだけにし、減点しない待ったと盤面を戻した回数は内訳に置く。 */
export function NonogramResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: NonogramResultScreenProps) {
  const { workload } = result;
  return (
    <GameResultScreen
      gameName={NONOGRAM_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={nonogramPictogramSvg}
      score={result.score.total}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("塗り直し", result.repaintCount, "マス"),
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(result.score, NONOGRAM_SCORE_MAXIMUMS),
        createOperationCountMetric("undo", result.undoCount),
        createOperationCountMetric("restart", result.restartCount),
        createSpeedFullScoreMetric(result.speedRule),
        createCountMetric("行・列", workload.width + workload.height, "本"),
        createCountMetric("塗るマス", workload.filledCellCount, "マス"),
        createCountMetric("連鎖の段", workload.roundCount, "回"),
      ]}
      scoreCriteria={getNonogramScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
