import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import type { MinesweeperCellCue } from "@/games/minesweeper/ui/board/cell-cue";
import {
  getMinesweeperBoardCellShapeClassName,
  getMinesweeperCellFaceClassName,
  MinesweeperCellFace,
} from "@/games/minesweeper/ui/board/MinesweeperCellFace";

const LONG_PRESS_DELAY_MS = 450;

/**
 * 印と応えの線は、マスの面の上に、面の縁から少し内側へ引く。面の縁と浮いたマスの下の縁は線と近い明るさなので、縁に重ねると線が埋もれる。
 * 角丸は、面の角丸（4px）を同じだけ内側へずらした形なので角が立つ。
 */
const cueOutlinePlacementClassName = "pointer-events-none absolute inset-[4px]";

type MinesweeperCellProps = {
  cellIndex: number;
  view: MinesweeperVisibleCell;
  disabled: boolean;
  cue?: MinesweeperCellCue;
  spotlit?: boolean;
  onPress: (cellIndex: number) => void;
  onFlagPress: (cellIndex: number) => void;
};

function getAccessibleName(
  cellIndex: number,
  view: MinesweeperVisibleCell,
): string {
  const position = `マス ${cellIndex + 1}`;
  if (view.state === "flagged") {
    return `${position} 旗`;
  }
  if (view.state === "revealed") {
    return view.adjacentMineCount === 0
      ? `${position} 開示済み 空白`
      : `${position} 開示済み ${view.adjacentMineCount}`;
  }
  if (view.state === "mine") {
    return `${position} 地雷`;
  }
  if (view.state === "steppedMine") {
    return `${position} 踏んだ地雷`;
  }
  return `${position} 未開示`;
}

function getCellClassName(view: MinesweeperVisibleCell): string {
  const faceClassName = getMinesweeperCellFaceClassName(view, "board");
  const interactionClassName =
    "relative min-w-0 touch-manipulation select-none outline-none [-webkit-touch-callout:none] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none";
  // 押している閉じたマスは、指に隠れても周りに見えるよう、沈めて縁に濃い輪を回す。
  const pressedClassName =
    "data-pressed:z-10 data-pressed:translate-y-px data-pressed:brightness-[0.88] data-pressed:outline-solid data-pressed:outline-3 data-pressed:outline-offset-[-2px] data-pressed:outline-blue-600 dark:data-pressed:outline-sky-300";

  if (view.state === "hidden") {
    return `${faceClassName} ${interactionClassName} ${pressedClassName} transition-[filter] duration-75 hover:brightness-[1.015]`;
  }
  if (view.state === "flagged") {
    return `${faceClassName} ${interactionClassName} ${pressedClassName}`;
  }
  return `${faceClassName} ${interactionClassName}`;
}

function isPointInside(element: Element, x: number, y: number): boolean {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  return x >= left && x <= right && y >= top && y <= bottom;
}

export function MinesweeperCell({
  cellIndex,
  view,
  disabled,
  cue,
  spotlit = false,
  onPress,
  onFlagPress,
}: MinesweeperCellProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  // 押している間の見た目と、指をずらして取り消したかを持つ。取り消した押下では、離したときのクリックを受けない。
  const [pressed, setPressed] = useState(false);
  const pressingRef = useRef(false);
  const pressCancelledRef = useRef(false);

  function clearLongPressTimer(): void {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    if (disabled) {
      return;
    }

    longPressTriggeredRef.current = false;
    pressCancelledRef.current = false;
    clearLongPressTimer();
    if (event.button !== 0) {
      return;
    }
    pressingRef.current = true;
    setPressed(true);
    longPressTimerRef.current = setTimeout(function handleLongPress() {
      longPressTriggeredRef.current = true;
      pressingRef.current = false;
      setPressed(false);
      onFlagPress(cellIndex);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DELAY_MS);
  }

  function cancelPress(): void {
    if (!pressingRef.current) {
      return;
    }
    pressingRef.current = false;
    pressCancelledRef.current = true;
    setPressed(false);
    clearLongPressTimer();
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    // タッチは押したマスに捕まえられたまま指の動きが届くので、マスの外へ出たかを位置で確かめる。
    if (
      pressingRef.current &&
      !isPointInside(event.currentTarget, event.clientX, event.clientY)
    ) {
      cancelPress();
    }
  }

  function handlePointerUp(): void {
    pressingRef.current = false;
    setPressed(false);
    clearLongPressTimer();
  }

  function handleClick(): void {
    if (longPressTriggeredRef.current || pressCancelledRef.current) {
      longPressTriggeredRef.current = false;
      pressCancelledRef.current = false;
      return;
    }
    onPress(cellIndex);
  }

  function handleContextMenu(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    if (disabled || longPressTriggeredRef.current) {
      return;
    }
    clearLongPressTimer();
    pressingRef.current = false;
    setPressed(false);
    longPressTriggeredRef.current = true;
    onFlagPress(cellIndex);
  }

  return (
    <button
      type="button"
      aria-label={getAccessibleName(cellIndex, view)}
      disabled={disabled}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      data-cell-index={cellIndex}
      data-pressed={pressed || undefined}
      data-cell-state={view.state}
      className={getCellClassName(view)}
    >
      <MinesweeperCellFace view={view} size="board" />
      {/* 浮いたマスは下の縁まで含めた、見えるマスの形のまま覆いから抜く。 */}
      <TutorialSpotlight
        active={spotlit}
        className={getMinesweeperBoardCellShapeClassName(view)}
      />
      {cue?.kind === "fitted" && (
        <span
          aria-hidden="true"
          data-cell-cue={cue.kind}
          className={cueOutlinePlacementClassName}
        >
          <TutorialCue kind="acknowledgement" id={cue.id} />
        </span>
      )}
      {(cue?.kind === "hint" || cue?.kind === "recall") && (
        <span
          aria-hidden="true"
          data-cell-cue="hint"
          className={cueOutlinePlacementClassName}
        >
          <TutorialCue
            kind="mark"
            recallId={cue.kind === "recall" ? cue.id : null}
          />
        </span>
      )}
    </button>
  );
}
