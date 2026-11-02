import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import bridgesPictogramSvg from "@/games/bridges/assets/pictogram.svg?raw";
import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import type { BridgesResult } from "@/games/bridges/play/use-bridges-play";
import { BRIDGES_SCORE_MAXIMUMS } from "@/games/bridges/score";
import { getBridgesScoreCriteria } from "@/games/bridges/ui/result/BridgesResultScreen/score-criteria";
import { getDifficultyLabel } from "@/games/difficulty";
import type { GamePlayResultScreenProps } from "@/games/play";

type BridgesResultScreenProps = GamePlayResultScreenProps<
  BridgesDifficulty,
  BridgesResult
>;

/**
 * 内訳はこのプレイの点と操作の回数、基準時間だけにする。問題の作業の量（島・橋・読みの回数）は、
 * 成績と並べると自分の成績と読み違えられるので、採点基準の基準時間の式の中で、この問題の値として示す。
 */
function listScoreBreakdown(result: BridgesResult) {
  return [
    ...listScoreBreakdownMetrics(result.score, BRIDGES_SCORE_MAXIMUMS),
    createOperationCountMetric("undo", result.undoCount),
    createOperationCountMetric("restart", result.restartCount),
    createCountMetric("交わる橋に阻まれた", result.blockedCount, "回"),
    createSpeedFullScoreMetric(result.speedRule),
  ];
}

export function BridgesResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: BridgesResultScreenProps) {
  return (
    <GameResultScreen
      gameName={BRIDGES_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={bridgesPictogramSvg}
      // 点は速さだけなので、主な成績は時間と、架けた・外した操作の回数（解に要る本数より多い分が架け直し）にする。
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("橋の操作", result.inputCount, "回"),
      ]}
      score={result.score.total}
      scoreBreakdown={listScoreBreakdown(result)}
      scoreCriteria={getBridgesScoreCriteria(result)}
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
