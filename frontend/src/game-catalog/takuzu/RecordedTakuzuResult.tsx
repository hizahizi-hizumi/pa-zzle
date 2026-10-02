import { type ReactNode, useState } from "react";

import { createPlayLocationState } from "@/game-catalog/play-location-state";
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
import { useNavigate } from "@/router";

type RecordedTakuzuResultProps = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  result: TakuzuResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

/** 記録から作り直したバイナリパズルの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedTakuzuResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
}: RecordedTakuzuResultProps) {
  const navigate = useNavigate();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createTakuzuDiagnosticSnapshot({
        difficulty,
        problemIdentity,
        buildRevision,
      })
    : null;

  function startNewProblem() {
    navigate("/puzzles/takuzu/play/:difficulty", {
      params: { difficulty },
      state: createPlayLocationState(createProblemId(problemIdentity)),
    });
  }

  return (
    <>
      <TakuzuResultScreen
        difficulty={difficulty}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={startNewProblem}
        onOpenRecords={onOpenRecords}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
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
