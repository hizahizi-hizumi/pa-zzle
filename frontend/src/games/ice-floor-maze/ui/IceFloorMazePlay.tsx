import { useEffect, useRef, useState } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import type {
  IceFloorMazeOperation,
  IceFloorMazeResult,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazeBoard as IceFloorMazeBoardState } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import { IceFloorMazeBoard } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";
import { IceFloorMazeHowToPlayDialog } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog";
import { IceFloorMazeDirectionPad } from "@/games/ice-floor-maze/ui/IceFloorMazePlay/IceFloorMazeDirectionPad";
import { IceFloorMazeSwipeArea } from "@/games/ice-floor-maze/ui/IceFloorMazePlay/IceFloorMazeSwipeArea";
import { IceFloorMazeTrappedNotice } from "@/games/ice-floor-maze/ui/IceFloorMazePlay/IceFloorMazeTrappedNotice";
import { IceFloorMazeResultScreen } from "@/games/ice-floor-maze/ui/result/IceFloorMazeResultScreen";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";

type IceFloorMazePlayProps = GamePlayScreenProps<
  IceFloorMazeDifficulty,
  IceFloorMazeResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    board: IceFloorMazeBoardState;
    goal: number;
    /** 駒のいるマス。 */
    position: number;
    moveCount: number;
    isTrapped: boolean;
    operation: IceFloorMazeOperation | null;
    onSlide: (direction: IceFloorMazeDirection) => void;
  };

const directionByArrowKey: Readonly<Record<string, IceFloorMazeDirection>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function IceFloorMazePlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  board,
  goal,
  position,
  moveCount,
  isTrapped,
  operation,
  onSlide,
  canUndo,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onClearAnimationComplete,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: IceFloorMazePlayProps) {
  const playAreaRef = useRef<HTMLElement>(null);
  const [slideAnimating, setSlideAnimating] = useState(false);
  const playing = progress === "playing";
  // 駒が閉じ込めの位置へ滑り着いてから知らせる。
  const showTrappedNotice = isTrapped && !slideAnimating;

  useEffect(() => {
    if (!playing) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const direction = directionByArrowKey[event.key];
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
      // 押し続けたときの繰り返しは、止まった後に同じ向きへ押し戻しを重ねるだけなので滑らせない。
      if (!event.repeat) {
        onSlide(direction);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSlide, playing]);

  return (
    <GamePlayFrame
      ref={playAreaRef}
      progress={progress}
      result={result}
      title={ICE_FLOOR_MAZE_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "手数", count: moveCount },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <IceFloorMazeHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <IceFloorMazeResultScreen
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
      <IceFloorMazeSwipeArea disabled={!playing} onSwipe={onSlide}>
        <IceFloorMazeBoard
          board={board}
          goal={goal}
          position={position}
          operation={operation}
          clearing={progress === "clearing"}
          onSlideAnimationActivityChange={setSlideAnimating}
          onClearAnimationComplete={onClearAnimationComplete}
        />
      </IceFloorMazeSwipeArea>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        {showTrappedNotice ? (
          <IceFloorMazeTrappedNotice
            canUndo={canUndo}
            onUndo={onUndo}
            onRestart={onRestart}
          />
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
            <div className="justify-self-end">
              <UndoButton disabled={!canUndo} onUndo={onUndo} />
            </div>
            <IceFloorMazeDirectionPad disabled={!playing} onSlide={onSlide} />
          </div>
        )}
      </footer>
    </GamePlayFrame>
  );
}
