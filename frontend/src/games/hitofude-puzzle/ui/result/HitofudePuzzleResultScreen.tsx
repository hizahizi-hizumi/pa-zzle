import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import { getDifficultyLabel } from "@/games/difficulty";
import hitofudePuzzlePictogramSvg from "@/games/hitofude-puzzle/assets/pictogram.svg?raw";
import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import type { HitofudePuzzleResult } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import { HITOFUDE_PUZZLE_SCORE_MAXIMUMS } from "@/games/hitofude-puzzle/score";
import { getHitofudePuzzleScoreCriteria } from "@/games/hitofude-puzzle/ui/result/HitofudePuzzleResultScreen/score-criteria";
import type { GamePlayResultScreenProps } from "@/games/play";

type HitofudePuzzleResultScreenProps = GamePlayResultScreenProps<
  HitofudePuzzleDifficulty,
  HitofudePuzzleResult
>;

/**
 * 内訳はこのプレイの点と操作の回数、基準時間だけにする。問題の作業の量（通るマス・分かれ道・先読み）は、
 * 成績と並べると自分の成績と読み違えられるので、採点基準の基準時間の式の中で、この問題の値として示す。
 */
function listScoreBreakdown(result: HitofudePuzzleResult) {
  return [
    ...listScoreBreakdownMetrics(result.score, HITOFUDE_PUZZLE_SCORE_MAXIMUMS),
    createOperationCountMetric("undo", result.undoCount),
    createOperationCountMetric("restart", result.restartCount),
    createSpeedFullScoreMetric(result.speedRule),
  ];
}

export function HitofudePuzzleResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: HitofudePuzzleResultScreenProps) {
  return (
    <GameResultScreen
      gameName={HITOFUDE_PUZZLE_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={hitofudePuzzlePictogramSvg}
      // 待った・盤面を戻すの回数は点に入らないので内訳に置き、主な成績は時間と、正確さの元の引き直しにする。
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("引き直し", result.backtrackCount, "回"),
      ]}
      score={result.score.total}
      scoreBreakdown={listScoreBreakdown(result)}
      scoreCriteria={getHitofudePuzzleScoreCriteria(result)}
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
