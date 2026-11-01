import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";

import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import type { MinesweeperCellCue } from "@/games/minesweeper/ui/board/cell-cue";
import {
  getMinesweeperCellFaceClassName,
  MinesweeperCellFace,
} from "@/games/minesweeper/ui/board/MinesweeperCellFace";

const LONG_PRESS_DELAY_MS = 450;

type MinesweeperCellProps = {
  cellIndex: number;
  view: MinesweeperVisibleCell;
  disabled: boolean;
  cues?: readonly MinesweeperCellCue[];
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
    "relative isolate min-w-0 touch-manipulation select-none outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none";

  if (view.state === "hidden" || view.state === "flagged") {
    return `${faceClassName} ${interactionClassName} hover:bg-slate-300 dark:hover:bg-slate-600`;
  }
  return `${faceClassName} ${interactionClassName}`;
}

export function MinesweeperCell({
  cellIndex,
  view,
  disabled,
  cues = [],
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
      {cues.map((cue) => (
        <MinesweeperCellCueMark key={`${cue.kind}:${cue.id}`} cue={cue} />
      ))}
    </button>
  );
}

/** 光の合図は透明度だけで消し、動きを減らす設定でも見て分かるようにする。 */
const cueClassNames = {
  fitted:
    "inset-1 rounded-sm bg-sky-100/60 ring-2 ring-sky-500/50 ring-inset fill-mode-forwards animate-out fade-out-0 duration-900 ease-in dark:bg-sky-900/50 dark:ring-sky-300/50",
  reason:
    "inset-0 bg-sky-100/70 ring-2 ring-sky-500/50 ring-inset fill-mode-forwards animate-out fade-out-0 duration-900 ease-in dark:bg-sky-900/50 dark:ring-sky-300/50",
  clue: "inset-0 bg-sky-100/80 ring-2 ring-sky-500/60 ring-inset animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none dark:bg-sky-900/60 dark:ring-sky-300/60",
  hint: "inset-1 rounded-sm border-[3px] border-sky-600 border-dashed dark:border-sky-400",
  rejected:
    "inset-0 ring-[3px] ring-destructive ring-inset fill-mode-forwards animate-out fade-out-0 duration-900 ease-in",
} as const satisfies Record<MinesweeperCellCue["kind"], string>;

/**
 * マスに重ねる合図。数字や旗を隠さないよう、マスの面と中身の間に描く。
 * 次に操作するマスの印は、付け直すたびに中を一瞬光らせ、受け付けなかった手にも印で応える。
 */
function MinesweeperCellCueMark({ cue }: { cue: MinesweeperCellCue }) {
  return (
    <span
      aria-hidden="true"
      data-cell-cue={cue.kind}
      className={`pointer-events-none absolute -z-10 ${cueClassNames[cue.kind]}`}
    >
      {cue.kind === "hint" && (
        <span className="absolute inset-0 bg-sky-200/80 fill-mode-forwards animate-out fade-out-0 duration-700 ease-in dark:bg-sky-800/70" />
      )}
    </span>
  );
}
