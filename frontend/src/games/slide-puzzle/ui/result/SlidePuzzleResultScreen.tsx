import type { ReactNode } from "react";
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
import slidePuzzlePictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import type { SlidePuzzleResult } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { SLIDE_PUZZLE_SCORE_MAXIMUMS } from "@/games/slide-puzzle/score";
import { getSlidePuzzleScoreCriteria } from "@/games/slide-puzzle/ui/result/SlidePuzzleResultScreen/score-criteria";

type SlidePuzzleResultScreenProps = {
  difficulty: SlidePuzzleDifficulty;
  result: SlidePuzzleResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function SlidePuzzleResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: SlidePuzzleResultScreenProps) {
  return (
    <GameResultScreen
      gameName={SLIDE_PUZZLE_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={slidePuzzlePictogramSvg}
      score={result.score.total}
      metrics={[createMoveCountMetric(result), createElapsedTimeMetric(result)]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(result.score, SLIDE_PUZZLE_SCORE_MAXIMUMS),
        createCountMetric("最短手数", result.optimalMoveCount, "手"),
        createSpeedFullScoreMetric(result.speedRule),
        createCountMetric("完成時の手数", result.completionMoveCount, "手"),
        createOperationCountMetric("restart", result.restartCount),
        createCountMetric("スライド操作", result.slideCount, "回"),
      ]}
      scoreCriteria={getSlidePuzzleScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
