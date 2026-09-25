import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from "react";

import { getTakuzuCellPosition } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type { TakuzuCellView } from "@/games/takuzu/session/session";

type TakuzuCellProps = {
  size: number;
  cellIndex: number;
  view: TakuzuCellView;
  disabled: boolean;
  onCycle: (cellIndex: number, direction: TakuzuCycleDirection) => void;
};

const tileNameByCell = { a: "A", b: "B" } as const;

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

function getTileClassName(view: TakuzuCellView): string {
  if (view.cell === "a") {
    return "size-[78%] rounded-md bg-sky-700 dark:bg-sky-400";
  }
  if (view.cell === "b") {
    return "size-[78%] rounded-full border-4 border-amber-500 bg-amber-100 dark:border-amber-300 dark:bg-amber-50";
  }
  return "size-0";
}

export function TakuzuCell({
  size,
  cellIndex,
  view,
  disabled,
  onCycle,
}: TakuzuCellProps) {
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
      className="relative flex min-h-0 min-w-0 touch-manipulation select-none items-center justify-center rounded-sm bg-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default data-violated:outline-2 data-violated:outline-rose-500 data-violated:outline-dashed data-violated:-outline-offset-2 dark:bg-slate-800"
    >
      <span aria-hidden="true" className={getTileClassName(view)} />
      {view.given ? (
        <span
          aria-hidden="true"
          className="absolute top-1 left-1 size-1.5 rounded-full bg-slate-500 dark:bg-slate-400"
        />
      ) : null}
    </button>
  );
}
