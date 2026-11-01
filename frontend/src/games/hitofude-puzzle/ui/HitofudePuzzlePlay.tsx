import { useEffect, useRef } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import type {
  HitofudePuzzleBlockedMove,
  HitofudePuzzlePathNotice,
  HitofudePuzzleResult,
} from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import type {
  HitofudePuzzleBoard as HitofudePuzzleBoardState,
  HitofudePuzzleDirection,
} from "@/games/hitofude-puzzle/puzzle/board";
import type { HitofudePuzzleTraceStep } from "@/games/hitofude-puzzle/puzzle/transitions";
import { findArrowKeyDirection } from "@/games/hitofude-puzzle/ui/arrow-key-direction";
import { HitofudePuzzleBoard } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard";
import { HitofudePuzzleHowToPlayDialog } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog";
import { HitofudePuzzleStatusAnnouncement } from "@/games/hitofude-puzzle/ui/HitofudePuzzlePlay/HitofudePuzzleStatusAnnouncement";
import { HitofudePuzzleResultScreen } from "@/games/hitofude-puzzle/ui/result/HitofudePuzzleResultScreen";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type HitofudePuzzlePlayProps = GamePlayScreenProps<
  HitofudePuzzleDifficulty,
  HitofudePuzzleResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    board: HitofudePuzzleBoardState;
    path: readonly number[];
    isDeadEnd: boolean;
    strandedCells: readonly number[];
    blockedMove: HitofudePuzzleBlockedMove | null;
    pathNotice: HitofudePuzzlePathNotice | null;
    backtrackCount: number;
    undoCount: number;
    onBeginStroke: (cell: number) => void;
    onTraceStroke: (step: HitofudePuzzleTraceStep) => void;
    onEndStroke: () => void;
    onMoveHeadToward: (direction: HitofudePuzzleDirection) => void;
  };

export function HitofudePuzzlePlay({
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
  pathNotice,
  backtrackCount,
  undoCount,
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
}: HitofudePuzzlePlayProps) {
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
      title={HITOFUDE_PUZZLE_DISPLAY_NAME}
      // 引き直しは正確さの元なので、バイナリパズルの置き直しと同じく見出しの先頭に置き、待ったを添える。
      metrics={[
        { type: "count", label: "引き直し", count: backtrackCount },
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: PLAY_OPERATION_LABELS.undo, count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <HitofudePuzzleHowToPlayDialog
          open={open}
          difficulty={difficulty}
          onClose={onClose}
        />
      )}
      renderResultScreen={(clearedResult) => (
        <HitofudePuzzleResultScreen
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
          <HitofudePuzzleBoard
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
        <HitofudePuzzleStatusAnnouncement
          board={board}
          notice={pathNotice}
          isDeadEnd={isDeadEnd}
          strandedCellCount={strandedCells.length}
        />
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        <div className="flex h-14 items-center justify-center">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
        </div>
      </footer>
    </GamePlayFrame>
  );
}
