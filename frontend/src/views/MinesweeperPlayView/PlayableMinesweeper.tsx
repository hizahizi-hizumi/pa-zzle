import { useState } from "react";

import { createMinesweeperDiagnosticSnapshot } from "@/games/minesweeper/diagnostics";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { useMinesweeperPlay } from "@/games/minesweeper/play/use-minesweeper-play";
import type { MinesweeperProblemIdentity } from "@/games/minesweeper/problem/problem";
import { MinesweeperDiagnostics } from "@/games/minesweeper/ui/MinesweeperDiagnostics";
import { MinesweeperPlay } from "@/games/minesweeper/ui/MinesweeperPlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useNavigate } from "@/router";

type PlayableMinesweeperProps = {
  difficulty: MinesweeperDifficulty;
  initialProblemIdentity?: MinesweeperProblemIdentity;
};

export function PlayableMinesweeper({
  difficulty,
  initialProblemIdentity,
}: PlayableMinesweeperProps) {
  const play = useMinesweeperPlay(difficulty, initialProblemIdentity);
  const navigate = useNavigate();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createMinesweeperDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <MinesweeperPlay
        rows={play.rows}
        columns={play.columns}
        mineCount={play.mineCount}
        flagCount={play.flagCount}
        mistakeCount={play.mistakeCount}
        elapsedMs={play.elapsedMs}
        visibleCells={play.visibleCells}
        status={play.status}
        onRevealCell={play.revealCell}
        onToggleFlag={play.toggleFlag}
        onChordCell={play.chordCell}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onChangeDifficulty={() => navigate("/puzzles/minesweeper")}
        onBackToHome={() => navigate("/")}
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
