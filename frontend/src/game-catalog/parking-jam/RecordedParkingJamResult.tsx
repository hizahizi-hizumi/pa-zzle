import { type ReactNode, useMemo, useState } from "react";

import { createPlayLocationState } from "@/game-catalog/play-location-state";
import { createParkingJamDiagnosticSnapshot } from "@/games/parking-jam/diagnostics";
import {
  getParkingJamDifficultyLabel,
  type ParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import type { ParkingJamResult } from "@/games/parking-jam/play/use-parking-jam-play";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import { ParkingJamDiagnostics } from "@/games/parking-jam/ui/ParkingJamDiagnostics";
import { ParkingJamResultScreen } from "@/games/parking-jam/ui/result/ParkingJamResultScreen";
import { createProblemId } from "@/games/problem-id";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useNavigate } from "@/router";

type RecordedParkingJamResultProps = {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  result: ParkingJamResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

/** 記録から作り直したパーキングジャムの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedParkingJamResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
}: RecordedParkingJamResultProps) {
  const navigate = useNavigate();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  // 検証情報は問題を復元して難易度分析を伴うので、開いたときだけ作る。
  const diagnostics = useMemo(
    () =>
      internalDiagnosticsAvailable && diagnosticsOpen
        ? createParkingJamDiagnosticSnapshot({
            difficulty,
            problemIdentity,
            buildRevision,
          })
        : null,
    [difficulty, diagnosticsOpen, problemIdentity],
  );

  function startNewProblem() {
    navigate("/puzzles/parking-jam/play/:difficulty", {
      params: { difficulty },
      state: createPlayLocationState(createProblemId(problemIdentity)),
    });
  }

  return (
    <>
      <ParkingJamResultScreen
        difficultyLabel={getParkingJamDifficultyLabel(difficulty)}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={startNewProblem}
        onOpenRecords={onOpenRecords}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={
          internalDiagnosticsAvailable
            ? () => setDiagnosticsOpen(true)
            : undefined
        }
      />
      {diagnostics && (
        <ParkingJamDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
