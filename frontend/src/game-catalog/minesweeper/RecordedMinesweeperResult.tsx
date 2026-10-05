import { type ReactNode, useState } from "react";

import type { GameNavigation } from "@/game-catalog/game-catalog-entry";
import { createMinesweeperDiagnosticSnapshot } from "@/games/minesweeper/diagnostics";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import type { MinesweeperResult } from "@/games/minesweeper/play/use-minesweeper-play";
import type { MinesweeperProblemIdentity } from "@/games/minesweeper/problem/problem";
import { MinesweeperDiagnostics } from "@/games/minesweeper/ui/MinesweeperDiagnostics";
import { MinesweeperResultScreen } from "@/games/minesweeper/ui/result/MinesweeperResultScreen";
import { createProblemId } from "@/games/problem-id";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";

type RecordedMinesweeperResultProps = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  result: MinesweeperResult;
  recordOutcomeNotice: ReactNode;
  onReplay: (() => void) | undefined;
  navigation: GameNavigation;
};

/** 記録から作り直したマインスイーパーの結果画面。次の問題は記録と同じ難易度で、記録の問題を避けて始める。 */
export function RecordedMinesweeperResult({
  difficulty,
  problemIdentity,
  result,
  recordOutcomeNotice,
  onReplay,
  navigation,
}: RecordedMinesweeperResultProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createMinesweeperDiagnosticSnapshot({
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
      <MinesweeperResultScreen
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
        <MinesweeperDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
