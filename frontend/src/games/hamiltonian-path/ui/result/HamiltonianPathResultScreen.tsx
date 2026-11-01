import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import { getDifficultyLabel } from "@/games/difficulty";
import hamiltonianPathPictogramSvg from "@/games/hamiltonian-path/assets/pictogram.svg?raw";
import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import { HAMILTONIAN_PATH_DISPLAY_NAME } from "@/games/hamiltonian-path/display-name";
import type { HamiltonianPathResult } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import { HAMILTONIAN_PATH_SCORE_MAXIMUMS } from "@/games/hamiltonian-path/score";
import { getHamiltonianPathScoreCriteria } from "@/games/hamiltonian-path/ui/result/HamiltonianPathResultScreen/score-criteria";
import type { GamePlayResultScreenProps } from "@/games/play";

type HamiltonianPathResultScreenProps = GamePlayResultScreenProps<
  HamiltonianPathDifficulty,
  HamiltonianPathResult
>;

function listScoreBreakdown(result: HamiltonianPathResult) {
  const { workload } = result;
  return [
    ...listScoreBreakdownMetrics(result.score, HAMILTONIAN_PATH_SCORE_MAXIMUMS),
    createOperationCountMetric("undo", result.undoCount),
    createOperationCountMetric("restart", result.restartCount),
    createSpeedFullScoreMetric(result.speedRule),
    createCountMetric("なぞるマス", workload.openCellCount, "マス"),
    createCountMetric("迷う分岐", workload.fatalBranchCount, "か所"),
    createCountMetric("先読み", workload.assumptionCount, "回"),
    createCountMetric("先読みの手数", workload.refutationStepCount, "手"),
  ];
}

export function HamiltonianPathResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: HamiltonianPathResultScreenProps) {
  return (
    <GameResultScreen
      gameName={HAMILTONIAN_PATH_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={hamiltonianPathPictogramSvg}
      // 待った・盤面を戻すの回数は点に入らないので内訳に置き、主な成績は時間と、正確さの元の引き直しにする。
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("引き直し", result.backtrackCount, "回"),
      ]}
      score={result.score.total}
      scoreBreakdown={listScoreBreakdown(result)}
      scoreCriteria={getHamiltonianPathScoreCriteria(result)}
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
