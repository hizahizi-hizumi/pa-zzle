import type { ReactNode } from "react";
import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import reflectionPictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  getReflectionLaserPathPolicy,
  type ReflectionLaserPathMode,
} from "@/games/reflection/laser-path-mode";
import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import { REFLECTION_SCORE_MAXIMUMS } from "@/games/reflection/score";
import { getReflectionScoreCriteria } from "@/games/reflection/ui/result/ReflectionResultScreen/score-criteria";

type ReflectionResultScreenProps = {
  difficultyLabel: string;
  laserPathMode: ReflectionLaserPathMode;
  result: ReflectionResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

function listScoreBreakdown(
  result: ReflectionResult,
  showsCheckCount: boolean,
) {
  const { workload } = result;
  return [
    ...listScoreBreakdownMetrics(result.score, REFLECTION_SCORE_MAXIMUMS),
    createOperationCountMetric("restart", result.restartCount),
    ...(showsCheckCount
      ? [createCountMetric("光路の確認", result.laserCheckCount, "回")]
      : []),
    createSpeedFullScoreMetric(result.speedRule),
    createCountMetric("ピース", workload.pieceCount, "個"),
    createCountMetric("外周ヒント", workload.clueCount, "本"),
    createCountMetric("照らし直す局面", workload.propagationRoundCount, "回"),
    createCountMetric("仮に置いて確かめる", workload.assumptionTestCount, "回"),
    workload.trialMoveCount === null
      ? { label: "試し置き", value: "試し置きでは解けない" }
      : createCountMetric("試し置き", workload.trialMoveCount, "手"),
  ];
}

export function ReflectionResultScreen({
  difficultyLabel,
  laserPathMode,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: ReflectionResultScreenProps) {
  const { showsCheckCountInResult } =
    getReflectionLaserPathPolicy(laserPathMode);

  return (
    <GameResultScreen
      gameName={REFLECTION_DISPLAY_NAME}
      difficultyLabel={difficultyLabel}
      pictogramSvg={reflectionPictogramSvg}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("置き直し", result.relocationCount, "回"),
      ]}
      score={result.score.total}
      scoreBreakdown={listScoreBreakdown(result, showsCheckCountInResult)}
      scoreCriteria={getReflectionScoreCriteria(result)}
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
