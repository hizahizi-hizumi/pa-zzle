import { useState } from "react";

import { createReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import {
  getReflectionDifficultyLabel,
  type ReflectionDifficulty,
} from "@/games/reflection/difficulty";
import { reflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import { useReflectionPlay } from "@/games/reflection/play/use-reflection-play";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { ReflectionDiagnostics } from "@/games/reflection/ui/ReflectionDiagnostics";
import { ReflectionPlay } from "@/games/reflection/ui/ReflectionPlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useNavigate } from "@/router";

/**
 * 最初に遊ぶ問題を identity で指定する。
 * - `blind-comparison`: 人間の遊び比べ用に指定した問題。難易度を伏せる。
 */
type ReflectionInitialProblem = {
  identity: ReflectionProblemIdentity;
  purpose: "blind-comparison";
};

type PlayableReflectionProps = {
  difficulty: ReflectionDifficulty;
  initialProblem?: ReflectionInitialProblem;
};

const BLIND_COMPARISON_DIFFICULTY_LABEL = "問題指定";

export function PlayableReflection({
  difficulty,
  initialProblem,
}: PlayableReflectionProps) {
  const play = useReflectionPlay(difficulty, initialProblem?.identity);
  const navigate = useNavigate();
  const isBlindComparison =
    initialProblem?.purpose === "blind-comparison" &&
    play.problemSource === "given";
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createReflectionDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <ReflectionPlay
        difficultyLabel={
          isBlindComparison
            ? BLIND_COMPARISON_DIFFICULTY_LABEL
            : getReflectionDifficultyLabel(difficulty)
        }
        laserPathMode={reflectionLaserPathMode}
        progress={play.progress}
        board={play.board}
        clues={play.clues}
        inventory={play.inventory}
        stock={play.stock}
        selection={play.selection}
        laser={play.laser}
        relocationCount={play.relocationCount}
        undoCount={play.undoCount}
        elapsedMs={play.elapsedMs}
        canUndo={play.canUndo}
        canRestart={play.canRestart}
        onTapCell={play.tapCell}
        onTapStock={play.tapStock}
        onTapClue={play.tapClue}
        onRemovePiece={play.removePiece}
        onClearSelection={play.clearSelection}
        onUndo={play.undo}
        onRestart={play.restart}
        onReplay={play.replay}
        onClearAnimationComplete={play.completeClearAnimation}
        onStartNewProblem={play.startNewProblem}
        onChangeDifficulty={() => navigate("/puzzles/reflection")}
        onBackToHome={() => navigate("/")}
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && diagnosticsOpen && (
        <ReflectionDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
