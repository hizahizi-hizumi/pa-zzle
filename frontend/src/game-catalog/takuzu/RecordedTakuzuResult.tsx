import { type ReactNode, useState } from "react";

import type { GameNavigation } from "@/game-catalog/game-catalog-entry";
import { createProblemId } from "@/games/problem-id";
import { createTakuzuDiagnosticSnapshot } from "@/games/takuzu/diagnostics";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type { TakuzuResult } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { TakuzuResultScreen } from "@/games/takuzu/ui/result/TakuzuResultScreen";
import { TakuzuDiagnostics } from "@/games/takuzu/ui/TakuzuDiagnostics";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";

type RecordedTakuzuResultProps = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  result: TakuzuResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  navigation: GameNavigation;
};

/** 記録から作り直したバイナリパズルの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedTakuzuResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  navigation,
}: RecordedTakuzuResultProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createTakuzuDiagnosticSnapshot({
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
      <TakuzuResultScreen
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
        <TakuzuDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
