import { useMemo, useState } from "react";

import { createMinesweeperDiagnosticSnapshot } from "@/games/minesweeper/diagnostics";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { useMinesweeperPlay } from "@/games/minesweeper/play/use-minesweeper-play";
import {
  createMinesweeperPlayAttempt,
  createMinesweeperPlayAttemptProgress,
} from "@/games/minesweeper/play-attempt";
import {
  createMinesweeperPlayRecord,
  minesweeperPlayRecordDefinition,
} from "@/games/minesweeper/play-record";
import type { MinesweeperRestoredProblem } from "@/games/minesweeper/problem/generator";
import { MinesweeperDiagnostics } from "@/games/minesweeper/ui/MinesweeperDiagnostics";
import { MinesweeperPlay } from "@/games/minesweeper/ui/MinesweeperPlay";
import { minesweeperPlayRecordDisplay } from "@/games/minesweeper/ui/play-record-display";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { usePlayAttemptRecord } from "@/records/hooks/use-play-attempt-record";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableMinesweeperProps = {
  difficulty: MinesweeperDifficulty;
  initialProblem?: MinesweeperRestoredProblem;
};

export function PlayableMinesweeper({
  difficulty,
  initialProblem,
}: PlayableMinesweeperProps) {
  const play = useMinesweeperPlay(difficulty, initialProblem);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createMinesweeperPlayRecord({
            difficulty,
            problemIdentity: play.problemIdentity,
            startedAt: play.startedAt,
            completedAt: play.completedAt,
            result: play.result,
          })
        : null,
    [
      difficulty,
      play.completedAt,
      play.problemIdentity,
      play.result,
      play.startedAt,
    ],
  );
  const recordOutcome = useSavePlayRecord(
    playRecord,
    minesweeperPlayRecordDefinition,
  );
  const playAttempt = useMemo(
    () =>
      createMinesweeperPlayAttempt({
        difficulty,
        problemIdentity: play.problemIdentity,
        startedAt: play.startedAt,
      }),
    [difficulty, play.problemIdentity, play.startedAt],
  );
  usePlayAttemptRecord(playAttempt, {
    finished: play.completedAt !== null,
    getProgress(abandonedAt) {
      return createMinesweeperPlayAttemptProgress(play.session, abandonedAt);
    },
  });
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
        difficulty={play.difficulty}
        rows={play.rows}
        columns={play.columns}
        mineCount={play.mineCount}
        flagCount={play.flagCount}
        mistakeCount={play.mistakeCount}
        elapsedMs={play.elapsedMs}
        visibleCells={play.visibleCells}
        status={play.status}
        progress={play.progress}
        result={play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={minesweeperPlayRecordDisplay}
          />
        }
        onRevealCell={play.revealCell}
        onToggleFlag={play.toggleFlag}
        onChordCell={play.chordCell}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onChangeDifficulty={() => navigate("/puzzles/minesweeper")}
        onBackToHome={() => navigate("/")}
        onClearAnimationComplete={play.completeClearAnimation}
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
