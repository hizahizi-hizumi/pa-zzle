import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";

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
    "relative min-w-0 touch-manipulation select-none outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none";

  if (view.state === "hidden") {
    return `${faceClassName} ${interactionClassName} transition-[filter] duration-75 hover:brightness-[1.015] active:brightness-[0.95]`;
  }
  return `${faceClassName} ${interactionClassName}`;
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
    clearLongPressTimer();
    if (event.button !== 0) {
      return;
    }
    longPressTimerRef.current = setTimeout(function handleLongPress() {
      longPressTriggeredRef.current = true;
      onFlagPress(cellIndex);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DELAY_MS);
  }

  function handlePointerEnd(): void {
    clearLongPressTimer();
  }

  function handleClick(): void {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
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
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      data-cell-index={cellIndex}
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
          {cue.pointed ? (
            // 下のマスに決め手の数字があることが多いので、指はマスの中を指す。
            <TutorialCue
              kind="pointer"
              placement="center"
              recallId={cue.kind === "recall" ? cue.id : null}
            />
          ) : (
            <TutorialCue
              kind="mark"
              recallId={cue.kind === "recall" ? cue.id : null}
            />
          )}
        </span>
      )}
    </button>
  );
}
