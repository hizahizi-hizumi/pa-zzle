import { type ReactNode, useState } from "react";

import type { GameNavigation } from "@/game-catalog/game-catalog-entry";
import { createProblemId } from "@/games/problem-id";
import { createSlidePuzzleDiagnosticSnapshot } from "@/games/slide-puzzle/diagnostics";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import type { SlidePuzzleResult } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type { SlidePuzzleProblemIdentity } from "@/games/slide-puzzle/problem/problem";
import { SlidePuzzleResultScreen } from "@/games/slide-puzzle/ui/result/SlidePuzzleResultScreen";
import { SlidePuzzleDiagnostics } from "@/games/slide-puzzle/ui/SlidePuzzleDiagnostics";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";

type RecordedSlidePuzzleResultProps = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
  result: SlidePuzzleResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  navigation: GameNavigation;
};

/** 記録から作り直したスライドパズルの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedSlidePuzzleResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  navigation,
}: RecordedSlidePuzzleResultProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createSlidePuzzleDiagnosticSnapshot({
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
      <SlidePuzzleResultScreen
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
        <SlidePuzzleDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
