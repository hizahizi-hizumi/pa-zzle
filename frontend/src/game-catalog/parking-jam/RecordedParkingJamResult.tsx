import { type ReactNode, useMemo, useState } from "react";
import type { GameNavigation } from "@/game-catalog/game-catalog-entry";
import { getDifficultyLabel } from "@/games/difficulty";
import { createParkingJamDiagnosticSnapshot } from "@/games/parking-jam/diagnostics";
import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type { ParkingJamResult } from "@/games/parking-jam/play/use-parking-jam-play";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import { ParkingJamDiagnostics } from "@/games/parking-jam/ui/ParkingJamDiagnostics";
import { ParkingJamResultScreen } from "@/games/parking-jam/ui/result/ParkingJamResultScreen";
import { createProblemId } from "@/games/problem-id";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";

type RecordedParkingJamResultProps = {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  result: ParkingJamResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  navigation: GameNavigation;
};

/** 記録から作り直したパーキングジャムの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedParkingJamResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  navigation,
}: RecordedParkingJamResultProps) {
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
    navigation.startNewProblem(difficulty, createProblemId(problemIdentity));
  }

  return (
    <>
      <ParkingJamResultScreen
        difficultyLabel={getDifficultyLabel(difficulty)}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={startNewProblem}
        onOpenRecords={navigation.openRecords}
        onChangeDifficulty={navigation.changeDifficulty}
        onBackToHome={navigation.backToHome}
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
