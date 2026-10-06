import type { ReactNode } from "react";
import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import { getDifficultyLabel } from "@/games/difficulty";
import minesweeperPictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import type { MinesweeperResult } from "@/games/minesweeper/play/use-minesweeper-play";
import { MINESWEEPER_SCORE_MAXIMUMS } from "@/games/minesweeper/score";
import { getMinesweeperScoreCriteria } from "@/games/minesweeper/ui/result/MinesweeperResultScreen/score-criteria";

type MinesweeperResultScreenProps = {
  difficulty: MinesweeperDifficulty;
  result: MinesweeperResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function MinesweeperResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: MinesweeperResultScreenProps) {
  return (
    <GameResultScreen
      gameName="マインスイーパー"
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={minesweeperPictogramSvg}
      score={result.score.total}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("ミス", result.mistakeCount, "回"),
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(result.score, MINESWEEPER_SCORE_MAXIMUMS),
        createSpeedFullScoreMetric(result.speedRule),
        createCountMetric("地雷", result.mineCount, "個"),
        createCountMetric("開く操作の最小回数", result.minimumOpenCount, "回"),
      ]}
      scoreCriteria={getMinesweeperScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
