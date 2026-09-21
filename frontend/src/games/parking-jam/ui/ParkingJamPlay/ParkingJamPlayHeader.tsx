import { PlayHeader } from "@/components/PlayHeader";
import { formatParkingJamElapsedTime } from "@/games/parking-jam/ui/format-elapsed-time";

type ParkingJamPlayHeaderProps = {
  elapsedMs: number;
  failedMoveCount: number;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function ParkingJamPlayHeader({
  elapsedMs,
  failedMoveCount,
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: ParkingJamPlayHeaderProps) {
  return (
    <PlayHeader
      title="パーキングジャム"
      metrics={[
        { label: "ミス", value: String(failedMoveCount) },
        { label: "時間", value: formatParkingJamElapsedTime(elapsedMs) },
      ]}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
    />
  );
}
