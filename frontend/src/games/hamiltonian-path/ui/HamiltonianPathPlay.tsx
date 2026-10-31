import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import { HAMILTONIAN_PATH_DISPLAY_NAME } from "@/games/hamiltonian-path/display-name";
import type { HamiltonianPathResult } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import type { HamiltonianPathBoard as HamiltonianPathBoardState } from "@/games/hamiltonian-path/puzzle/board";
import { HamiltonianPathBoard } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard";
import { HamiltonianPathHowToPlayDialog } from "@/games/hamiltonian-path/ui/HamiltonianPathHowToPlayDialog";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";

type HamiltonianPathPlayProps = GamePlayScreenProps<
  HamiltonianPathDifficulty,
  HamiltonianPathResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    board: HamiltonianPathBoardState;
    path: readonly number[];
    onExtendPath: (cell: number) => void;
    onRewindPath: (cell: number) => void;
  };

export function HamiltonianPathPlay({
  progress,
  elapsedMs,
  result,
  board,
  path,
  canUndo,
  canRestart,
  onExtendPath,
  onRewindPath,
  onUndo,
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: HamiltonianPathPlayProps) {
  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={HAMILTONIAN_PATH_DISPLAY_NAME}
      metrics={[{ type: "elapsed-time", elapsedMs }]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <HamiltonianPathHowToPlayDialog open={open} onClose={onClose} />
      )}
      // 評価が無いうちは結果画面へ進まない（`result` は常に `null`）。
      renderResultScreen={() => null}
    >
      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-2 [container-type:size]">
        <div className="relative aspect-square w-[min(100cqw,100cqh,40rem)]">
          <HamiltonianPathBoard
            board={board}
            path={path}
            interactionDisabled={progress !== "playing"}
            onExtendPath={onExtendPath}
            onRewindPath={onRewindPath}
          />
        </div>
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        <div className="flex h-14 items-center justify-center">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
        </div>
      </footer>
    </GamePlayFrame>
  );
}
