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
import tsumeShogiPictogramSvg from "@/games/tsume-shogi/assets/pictogram.svg?raw";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import type { TsumeShogiResult } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { TSUME_SHOGI_SCORE_MAXIMUMS } from "@/games/tsume-shogi/score";
import { getTsumeShogiScoreCriteria } from "@/games/tsume-shogi/ui/result/TsumeShogiResultScreen/score-criteria";

type TsumeShogiResultScreenProps = GamePlayResultScreenProps<
  TsumeShogiDifficulty,
  TsumeShogiResult
>;

function listScoreBreakdown(result: TsumeShogiResult) {
  const { workload } = result;
  return [
    ...listScoreBreakdownMetrics(result.score, TSUME_SHOGI_SCORE_MAXIMUMS),
    createCountMetric("反証を見た", result.refutationViewCount, "回"),
    createOperationCountMetric("undo", result.undoCount),
    createOperationCountMetric("restart", result.restartCount),
    createSpeedFullScoreMetric(result.speedRule),
    createCountMetric("手数", workload.plies, "手"),
    createCountMetric("初手の王手", workload.rootChecks, "個"),
    createCountMetric("効いていそうな誤王手", workload.plausibleWrong, "個"),
    createCountMetric("数手先まで続く紛れ", workload.deepDecoyCount, "個"),
  ];
}

export function TsumeShogiResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TsumeShogiResultScreenProps) {
  return (
    <GameResultScreen
      gameName={TSUME_SHOGI_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={tsumeShogiPictogramSvg}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("誤王手", result.wrongCheckCount, "回"),
      ]}
      score={result.score.total}
      scoreBreakdown={listScoreBreakdown(result)}
      scoreCriteria={getTsumeShogiScoreCriteria(result)}
      recordOutcomeNotice={recordOutcomeNotice}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
