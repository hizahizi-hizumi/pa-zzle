import { PlayHeader } from "@/components/PlayHeader";
import { formatParkingJamElapsedTime } from "@/games/parking-jam/ui/format-elapsed-time";

type ParkingJamPlayHeaderProps = {
  elapsedMs: number;
  failedMoveCount: number;
  undoCount: number;
  canRestart: boolean;
  onRestart: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function ParkingJamPlayHeader({
  elapsedMs,
  failedMoveCount,
  undoCount,
  canRestart,
  onRestart,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: ParkingJamPlayHeaderProps) {
  return (
    <PlayHeader
      title="パーキングジャム"
      metricGroups={[
        [
          { label: "ミス", value: String(failedMoveCount) },
          { label: "時間", value: formatParkingJamElapsedTime(elapsedMs) },
          { label: "待った", value: String(undoCount) },
        ],
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
