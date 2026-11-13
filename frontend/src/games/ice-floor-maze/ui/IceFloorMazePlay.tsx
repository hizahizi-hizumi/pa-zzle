import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import type {
  IceFloorMazeBlockedInput,
  IceFloorMazeLastSlide,
  IceFloorMazeResult,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazeBoard as IceFloorMazeBoardState } from "@/games/ice-floor-maze/puzzle/board";
import {
  type IceFloorMazeDirection,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import { listIceFloorMazeElementIntroductions } from "@/games/ice-floor-maze/tutorial/tutorial";
import { IceFloorMazeBoard } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";
import { IceFloorMazeGround } from "@/games/ice-floor-maze/ui/IceFloorMazeGround";
import { IceFloorMazeHowToPlayDialog } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog";
import { IceFloorMazeElementNotice } from "@/games/ice-floor-maze/ui/IceFloorMazePlay/IceFloorMazeElementNotice";
import { IceFloorMazeTrappedNotice } from "@/games/ice-floor-maze/ui/IceFloorMazePlay/IceFloorMazeTrappedNotice";
import {
  markIceFloorMazeElementsSeen,
  readIceFloorMazeSeenElements,
} from "@/games/ice-floor-maze/ui/IceFloorMazePlay/seen-element-storage";
import { IceFloorMazeSwipeArea } from "@/games/ice-floor-maze/ui/IceFloorMazeSwipeArea";
import { IceFloorMazeTutorial } from "@/games/ice-floor-maze/ui/IceFloorMazeTutorial";
import { IceFloorMazeResultScreen } from "@/games/ice-floor-maze/ui/result/IceFloorMazeResultScreen";
import { useIceFloorMazeSoundEffects } from "@/games/ice-floor-maze/ui/use-ice-floor-maze-sound-effects";
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
    /** 今の盤面のマス。 */
    cells: readonly IceFloorMazeStateCell[];
    /** 滑る氷の塊のあるマス。 */
    blocks: readonly number[];
    goal: number;
    /** 駒のいるマス。 */
    position: number;
    moveCount: number;
    isTrapped: boolean;
    lastSlide: IceFloorMazeLastSlide | null;
    blockedInput: IceFloorMazeBlockedInput | null;
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
  recordFeedback,
  board,
  cells,
  blocks,
  goal,
  position,
  moveCount,
  isTrapped,
  lastSlide,
  blockedInput,
  onSlide,
  canUndo,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onClearAnimationComplete,
  onOpenGameHome,
  onBackToAppHome,
  onOpenDiagnostics,
}: IceFloorMazePlayProps) {
  const playAreaRef = useRef<HTMLElement>(null);
  const [slideAnimating, setSlideAnimating] = useState(false);
  const playing = progress === "playing";
  useIceFloorMazeSoundEffects(lastSlide, blockedInput, goal, progress);
  const beforeFirstMove = moveCount === 0;
  const unseenIntroductions = useMemo(() => {
    if (!beforeFirstMove) return [];
    const seen = readIceFloorMazeSeenElements();
    return listIceFloorMazeElementIntroductions(board).filter(
      ({ ruleId }) => !seen.has(ruleId),
    );
  }, [board, beforeFirstMove]);
  const elementNoticeShown =
    playing && beforeFirstMove && unseenIntroductions.length > 0;

  // 知らせ始める滑りでは、駒が滑り着いてから知らせる。知らせた後の滑りでは知らせを出したままにする。
  const showTrappedNotice =
    isTrapped && !(slideAnimating && lastSlide?.entersTrap === true);

  function handleSlide(direction: IceFloorMazeDirection): void {
    if (
      elementNoticeShown &&
      slideIceFloorMazePiece(board, { position, cells, blocks }, direction)
        .status !== "blocked"
    ) {
      markIceFloorMazeElementsSeen(
        unseenIntroductions.map(({ ruleId }) => ruleId),
      );
    }
    onSlide(direction);
  }

  const slideByKey = useEffectEvent(handleSlide);

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
        slideByKey(direction);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playing]);

  return (
    <GamePlayFrame
      ref={playAreaRef}
      progress={progress}
      result={result}
      title={ICE_FLOOR_MAZE_DISPLAY_NAME}
      background={<IceFloorMazeGround />}
      metrics={[
        { type: "count", label: "手数", count: moveCount },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToAppHome={onBackToAppHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <IceFloorMazeHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose }) => (
        <IceFloorMazeTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <IceFloorMazeResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordFeedback={recordFeedback}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <IceFloorMazeSwipeArea disabled={!playing} onSwipe={handleSlide}>
        <main className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
          <IceFloorMazeBoard
            board={board}
            cells={cells}
            blocks={blocks}
            goal={goal}
            position={position}
            lastSlide={lastSlide}
            blockedInput={blockedInput}
            clearing={progress === "clearing"}
            onSlideAnimationActivityChange={setSlideAnimating}
            onClearAnimationComplete={onClearAnimationComplete}
          />
        </main>
        {/* 一言と、もうゴールに止まれない知らせは、盤面の位置と大きさを変えないよう、高さを決めた欄の中に出す。 */}
        <footer className="relative flex h-32 shrink-0 flex-col justify-end px-4 pb-2">
          {elementNoticeShown ? (
            // 行数が増えても待ったの位置を動かさないよう、欄の流れから外して待ったの上に重ねる。
            <div className="absolute inset-x-4 bottom-16">
              <IceFloorMazeElementNotice introductions={unseenIntroductions} />
            </div>
          ) : null}
          {showTrappedNotice ? (
            <IceFloorMazeTrappedNotice
              canUndo={canUndo}
              onUndo={onUndo}
              onRestart={onRestart}
            />
          ) : (
            <div className="flex h-14 items-center justify-center">
              <UndoButton disabled={!canUndo} onUndo={onUndo} />
            </div>
          )}
        </footer>
      </IceFloorMazeSwipeArea>
    </GamePlayFrame>
  );
}
