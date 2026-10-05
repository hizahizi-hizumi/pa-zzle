import { type ReactNode, useState } from "react";

import type { GameNavigation } from "@/game-catalog/game-catalog-entry";
import { createNanpureDiagnosticSnapshot } from "@/games/nanpure/diagnostics";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import type { NanpureResult } from "@/games/nanpure/play/use-nanpure-play";
import type { NanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { NanpureDiagnostics } from "@/games/nanpure/ui/NanpureDiagnostics";
import { NanpureResultScreen } from "@/games/nanpure/ui/result/NanpureResultScreen";
import { createProblemId } from "@/games/problem-id";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";

type RecordedNanpureResultProps = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
  result: NanpureResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  navigation: GameNavigation;
};

/** 記録から作り直したナンプレの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedNanpureResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  navigation,
}: RecordedNanpureResultProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createNanpureDiagnosticSnapshot({
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
      <NanpureResultScreen
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
        <NanpureDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
