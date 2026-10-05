import type { ReactNode } from "react";
import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import { getDifficultyLabel } from "@/games/difficulty";
import nanpurePictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import type { NanpureResult } from "@/games/nanpure/play/use-nanpure-play";
import { NANPURE_SCORE_MAXIMUMS } from "@/games/nanpure/score";
import { getNanpureScoreCriteria } from "@/games/nanpure/ui/result/NanpureResultScreen/score-criteria";

type NanpureResultScreenProps = {
  difficulty: NanpureDifficulty;
  result: NanpureResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function NanpureResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: NanpureResultScreenProps) {
  return (
    <GameResultScreen
      gameName="ナンプレ"
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={nanpurePictogramSvg}
      score={result.score.total}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("ミス", result.mistakeCount, "回"),
        createOperationCountMetric("undo", result.undoCount),
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(result.score, NANPURE_SCORE_MAXIMUMS),
        createSpeedFullScoreMetric(result.speedRule),
        createOperationCountMetric("restart", result.restartCount),
      ]}
      scoreCriteria={getNanpureScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
