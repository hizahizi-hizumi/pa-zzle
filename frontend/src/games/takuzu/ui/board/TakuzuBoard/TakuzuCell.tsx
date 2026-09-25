import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from "react";

import { getTakuzuCellPosition } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { cn } from "@/lib/utils";

type TakuzuCellProps = {
  size: number;
  cellIndex: number;
  view: TakuzuCellView;
  disabled: boolean;
  onCycle: (cellIndex: number, direction: TakuzuCycleDirection) => void;
};

const tileNameByCell = { a: "四角", b: "丸" } as const;

function getAccessibleName(
  size: number,
  cellIndex: number,
  view: TakuzuCellView,
): string {
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  const content = view.cell === null ? "空き" : tileNameByCell[view.cell];
  const qualifiers = [
    view.given ? "固定" : null,
    view.violated ? "ルール違反" : null,
  ].filter((qualifier) => qualifier !== null);
  return [`${row + 1}行${column + 1}列`, content, ...qualifiers].join(" ");
}

// 固定タイルは前景色、置いたタイルはゲーム固有の青。形は同じにし、色の濃淡だけで分ける。
function getTileToneClassName(view: TakuzuCellView): string {
  return view.given ? "text-foreground" : "text-sky-700 dark:text-sky-300";
}

export function TakuzuCell({
  size,
  cellIndex,
  view,
  disabled,
  onCycle,
}: TakuzuCellProps) {
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  const interactive = !disabled && !view.given;
  const lastPointerTypeRef = useRef<string | null>(null);

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    lastPointerTypeRef.current = event.pointerType;
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    // タッチの長押しでも contextmenu が届く環境があるため、逆方向の巡回はマウスの右クリックに限る。
    const fromTouch = lastPointerTypeRef.current === "touch";
    if (interactive && !fromTouch) {
      onCycle(cellIndex, "backward");
    }
  }

  return (
    <button
      type="button"
      aria-label={getAccessibleName(size, cellIndex, view)}
      disabled={!interactive}
      onClick={() => onCycle(cellIndex, "forward")}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      data-violated={view.violated || undefined}
      className={cn(
        "relative flex min-h-0 min-w-0 touch-manipulation select-none items-center justify-center bg-background outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-default data-violated:bg-rose-100/80 dark:data-violated:bg-rose-950/50",
        row !== size - 1 && "border-b border-b-border",
        column !== size - 1 && "border-r border-r-border",
      )}
    >
      {view.cell !== null ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className={cn("size-[80%]", getTileToneClassName(view))}
        >
          {view.cell === "a" ? (
            <rect
              x="20"
              y="20"
              width="60"
              height="60"
              rx="6"
              fill="currentColor"
            />
          ) : (
            <circle
              cx="50"
              cy="50"
              r="26.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="9"
            />
          )}
        </svg>
      ) : null}
    </button>
  );
}
