import { useEffect, useRef } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import { HAMILTONIAN_PATH_DISPLAY_NAME } from "@/games/hamiltonian-path/display-name";
import type {
  HamiltonianPathBlockedMove,
  HamiltonianPathResult,
} from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import type {
  HamiltonianPathBoard as HamiltonianPathBoardState,
  HamiltonianPathDirection,
} from "@/games/hamiltonian-path/puzzle/board";
import type { HamiltonianPathTraceStep } from "@/games/hamiltonian-path/puzzle/transitions";
import { findArrowKeyDirection } from "@/games/hamiltonian-path/ui/arrow-key-direction";
import { HamiltonianPathBoard } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard";
import { HamiltonianPathHowToPlayDialog } from "@/games/hamiltonian-path/ui/HamiltonianPathHowToPlayDialog";
import { HamiltonianPathResultScreen } from "@/games/hamiltonian-path/ui/result/HamiltonianPathResultScreen";
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
    isDeadEnd: boolean;
    strandedCells: readonly number[];
    blockedMove: HamiltonianPathBlockedMove | null;
    onBeginStroke: (cell: number) => void;
    onTraceStroke: (step: HamiltonianPathTraceStep) => void;
    onEndStroke: () => void;
    onMoveHeadToward: (direction: HamiltonianPathDirection) => void;
  };

export function HamiltonianPathPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  board,
  path,
  isDeadEnd,
  strandedCells,
  blockedMove,
  canUndo,
  canRestart,
  onBeginStroke,
  onTraceStroke,
  onEndStroke,
  onMoveHeadToward,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: HamiltonianPathPlayProps) {
  const playAreaRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (progress !== "playing") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const direction = findArrowKeyDirection(event.key);
      // メニューやダイアログはプレイ画面の外へ描画される。そこでの操作や、矢印キーを自分で扱う部品の操作は盤面へ流さない。
      const { target } = event;
      const targetsPlayArea =
        target === document.body ||
        (target instanceof Node && playAreaRef.current?.contains(target));
      if (
        !direction ||
        !targetsPlayArea ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      onMoveHeadToward(direction);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onMoveHeadToward, progress]);

  return (
    <GamePlayFrame
      ref={playAreaRef}
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
        <HamiltonianPathHowToPlayDialog
          open={open}
          difficulty={difficulty}
          onClose={onClose}
        />
      )}
      renderResultScreen={(clearedResult) => (
        <HamiltonianPathResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordOutcomeNotice={recordOutcomeNotice}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenRecords={onOpenRecords}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      {/* 画面端から始まるタッチはブラウザの戻る操作に取られるので、盤面の左右に余白を残す。 */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-2 [container-type:size] sm:px-6">
        <div className="relative aspect-square w-[min(100cqw,100cqh,40rem)]">
          <HamiltonianPathBoard
            board={board}
            path={path}
            isDeadEnd={isDeadEnd}
            strandedCells={strandedCells}
            blockedMove={blockedMove}
            solved={progress !== "playing"}
            clearing={progress === "clearing"}
            interactionDisabled={progress !== "playing"}
            onBeginStroke={onBeginStroke}
            onTraceStroke={onTraceStroke}
            onEndStroke={onEndStroke}
            onClearAnimationComplete={onClearAnimationComplete}
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
