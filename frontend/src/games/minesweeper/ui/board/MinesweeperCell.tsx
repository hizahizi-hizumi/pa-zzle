import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import type { MinesweeperCellCue } from "@/games/minesweeper/ui/board/cell-cue";
import {
  getMinesweeperCellFaceClassName,
  MinesweeperCellFace,
} from "@/games/minesweeper/ui/board/MinesweeperCellFace";

const LONG_PRESS_DELAY_MS = 450;

/** 印と応えの線は、隣り合うマスの線と重ならないよう、マスの縁から少し内側に、角の立ったマスの形で引く。 */
const cueOutlinePlacementClassName = "pointer-events-none absolute inset-1";

type MinesweeperCellProps = {
  cellIndex: number;
  view: MinesweeperVisibleCell;
  disabled: boolean;
  /** チュートリアルで重ねる印と応え。通常のプレイでは渡さない。 */
  cue?: MinesweeperCellCue;
  /** チュートリアルで手を引いている間、画面全体の覆いからこのマスを抜き、元の明るさで見せる。 */
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
    "relative min-w-0 touch-manipulation select-none outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none";

  if (view.state === "hidden" || view.state === "flagged") {
    return `${faceClassName} ${interactionClassName} hover:bg-slate-300 dark:hover:bg-slate-600`;
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
    if (disabled || event.button !== 0) {
      return;
    }

    longPressTriggeredRef.current = false;
    clearLongPressTimer();
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
    if (!disabled) {
      onFlagPress(cellIndex);
    }
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
      className={getCellClassName(view)}
    >
      <MinesweeperCellFace view={view} size="board" />
      {/* マスの形のまま、角の無い四角で覆いから抜く。 */}
      <TutorialSpotlight active={spotlit} className="inset-0" />
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
