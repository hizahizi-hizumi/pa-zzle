import type { ReactNode } from "react";

import { GameResultScreen } from "@/components/GameResultScreen";
import parkingJamPictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import type { ParkingJamResult } from "@/games/parking-jam/play/use-parking-jam-play";
import { PARKING_JAM_SCORE_MAXIMUMS } from "@/games/parking-jam/score";
import { getParkingJamScoreCriteria } from "@/games/parking-jam/ui/ParkingJamPlay/ParkingJamResultScreen/score-criteria";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type ParkingJamResultScreenProps = {
  difficultyLabel: string;
  result: ParkingJamResult;
  recordOutcomeNotice: ReactNode;
  onReplay: () => void;
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
        { label: "時間", value: formatElapsedTime(result.elapsedMs) },
        { label: "ミス", value: String(result.failedMoveCount) },
        { label: "待った", value: String(result.undoCount) },
      ]}
      recordOutcomeNotice={recordOutcomeNotice}
      scoreBreakdown={[
        {
          label: "正確さ",
          value: `${result.score.breakdown.accuracy} / ${PARKING_JAM_SCORE_MAXIMUMS.accuracy}`,
        },
        {
          label: "速さ",
          value: `${result.score.breakdown.speed} / ${PARKING_JAM_SCORE_MAXIMUMS.speed}`,
        },
        {
          label: "安定性",
          value: `${result.score.breakdown.stability} / ${PARKING_JAM_SCORE_MAXIMUMS.stability}`,
        },
        { label: "やり直し", value: `${result.restartCount}回` },
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
