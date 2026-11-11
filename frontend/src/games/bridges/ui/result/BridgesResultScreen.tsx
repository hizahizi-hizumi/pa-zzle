import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
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
 * 内訳はこのプレイの点と、点に入らない操作の回数だけにする。問題の作業の量（島・橋・読みの回数）は、
 * 成績と並べると自分の成績と読み違えられ、遊ぶ人が盤面から数えられない量も含むので示さない。
 * 基準時間が何から決まるかは採点基準の文で示す。
 */
function listScoreBreakdown(result: BridgesResult) {
  return [
    ...listScoreBreakdownMetrics(result.score, BRIDGES_SCORE_MAXIMUMS),
    createOperationCountMetric("undo", result.undoCount),
    createOperationCountMetric("restart", result.restartCount),
    createCountMetric("交わる橋に阻まれた", result.blockedCount, "回"),
  ];
}

export function BridgesResultScreen({
  difficulty,
  result,
  recordFeedback,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onOpenDiagnostics,
}: BridgesResultScreenProps) {
  return (
    <GameResultScreen
      gameName={BRIDGES_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      // 点は速さだけなので、主な成績は点を決める時間と基準時間だけにする。操作の回数を並べると、手数で採点するゲームと同じ形に見える。
      metrics={[
        createElapsedTimeMetric(result),
        createSpeedFullScoreMetric(result.speedRule),
      ]}
      score={result.score.total}
      scoreBreakdown={listScoreBreakdown(result)}
      scoreCriteria={getBridgesScoreCriteria(result)}
      recordFeedback={recordFeedback}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenGameHome={onOpenGameHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
