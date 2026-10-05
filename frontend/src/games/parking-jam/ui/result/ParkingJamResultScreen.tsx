import type { ReactNode } from "react";
import { GameResultScreen } from "@/components/GameResultScreen";
import {
  createCountMetric,
  createElapsedTimeMetric,
  createOperationCountMetric,
  createSpeedFullScoreMetric,
  listScoreBreakdownMetrics,
} from "@/components/game-result-metrics";
import parkingJamPictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import type { ParkingJamResult } from "@/games/parking-jam/play/use-parking-jam-play";
import { PARKING_JAM_SCORE_MAXIMUMS } from "@/games/parking-jam/score";
import { getParkingJamScoreCriteria } from "@/games/parking-jam/ui/result/ParkingJamResultScreen/score-criteria";

type ParkingJamResultScreenProps = {
  difficultyLabel: string;
  result: ParkingJamResult;
  recordOutcomeNotice: ReactNode;
  /** 省略すると同じ問題を遊び直す操作を押せない状態で出す。 */
  onReplay?: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function ParkingJamResultScreen({
  difficultyLabel,
  result,
  recordOutcomeNotice,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: ParkingJamResultScreenProps) {
  return (
    <GameResultScreen
      gameName="パーキングジャム"
      difficultyLabel={difficultyLabel}
      pictogramSvg={parkingJamPictogramSvg}
      score={result.score.total}
      metrics={[
        createElapsedTimeMetric(result),
        createCountMetric("ミス", result.failedMoveCount, "回"),
        createOperationCountMetric("undo", result.undoCount),
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        ...listScoreBreakdownMetrics(result.score, PARKING_JAM_SCORE_MAXIMUMS),
        createSpeedFullScoreMetric(result.speedRule),
        createCountMetric("車", result.speedReference.vehicleCount, "台"),
        createCountMetric(
          "初めに塞がれた車",
          result.speedReference.initialBlockedVehicleCount,
          "台",
        ),
        createOperationCountMetric("restart", result.restartCount),
      ]}
      scoreCriteria={getParkingJamScoreCriteria(result)}
      onStartNewProblem={onStartNewProblem}
      onReplay={onReplay}
      onOpenRecords={onOpenRecords}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
