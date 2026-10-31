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
import iceFloorMazePictogramSvg from "@/games/ice-floor-maze/assets/pictogram.svg?raw";
import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import type { IceFloorMazeResult } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { ICE_FLOOR_MAZE_SCORE_MAXIMUMS } from "@/games/ice-floor-maze/score";
import { getIceFloorMazeScoreCriteria } from "@/games/ice-floor-maze/ui/result/IceFloorMazeResultScreen/score-criteria";
import type { GamePlayResultScreenProps } from "@/games/play";

type IceFloorMazeResultScreenProps = GamePlayResultScreenProps<
  IceFloorMazeDifficulty,
  IceFloorMazeResult
>;

export function IceFloorMazeResultScreen({
  difficulty,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: IceFloorMazeResultScreenProps) {
  return (
    <GameResultScreen
      gameName={ICE_FLOOR_MAZE_DISPLAY_NAME}
      difficultyLabel={getDifficultyLabel(difficulty)}
      pictogramSvg={iceFloorMazePictogramSvg}
      score={result.score.total}
      metrics={[createMoveCountMetric(result), createElapsedTimeMetric(result)]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(
          result.score,
          ICE_FLOOR_MAZE_SCORE_MAXIMUMS,
        ),
        createCountMetric("最短手数", result.optimalMoveCount, "手"),
        createSpeedFullScoreMetric(result.speedRule),
        createOperationCountMetric("undo", result.undoCount),
        createOperationCountMetric("restart", result.restartCount),
      ]}
      scoreCriteria={getIceFloorMazeScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
