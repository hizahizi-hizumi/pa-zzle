import { type ReactNode, useState } from "react";

import type { GameNavigation } from "@/game-catalog/game-catalog-entry";
import { createProblemId } from "@/games/problem-id";
import { createWaterSortDiagnosticSnapshot } from "@/games/water-sort/diagnostics";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import type { WaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortProblemIdentity } from "@/games/water-sort/problem/problem";
import { WaterSortResultScreen } from "@/games/water-sort/ui/result/WaterSortResultScreen";
import { WaterSortDiagnostics } from "@/games/water-sort/ui/WaterSortDiagnostics";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";

type RecordedWaterSortResultProps = {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  result: WaterSortResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  navigation: GameNavigation;
};

/** 記録から作り直したウォーターソートの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedWaterSortResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  navigation,
}: RecordedWaterSortResultProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createWaterSortDiagnosticSnapshot({
        difficulty,
        problemIdentity,
        buildRevision,
      })
    : null;

  function startNewProblem() {
    navigation.startNewProblem(difficulty, createProblemId(problemIdentity));
  }

  return (
    <>
      <WaterSortResultScreen
        difficulty={difficulty}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={startNewProblem}
        onOpenRecords={navigation.openRecords}
        onChangeDifficulty={navigation.changeDifficulty}
        onBackToHome={navigation.backToHome}
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && diagnosticsOpen && (
        <WaterSortDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
