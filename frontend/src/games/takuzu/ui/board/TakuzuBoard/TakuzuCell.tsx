import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
} from "react";

import { getTakuzuCellPosition } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { violationMarkTimingClassName } from "@/games/takuzu/ui/board/TakuzuBoard/violation-mark-timing";
import { TakuzuCellFace } from "@/games/takuzu/ui/board/TakuzuCellFace";
import { runViolationCellClassName } from "@/games/takuzu/ui/board/violation-mark-style";
import { cn } from "@/lib/utils";

type TakuzuCellProps = {
  size: number;
  cellIndex: number;
  view: TakuzuCellView;
  /** このマスを含む行・列の違反の読み上げ名（例「行の個数超過」）。 */
  lineViolationNames: readonly string[];
  disabled: boolean;
  focusable: boolean;
  onElementChange: (
    cellIndex: number,
    element: HTMLButtonElement | null,
  ) => void;
  onCycle: (cellIndex: number, direction: TakuzuCycleDirection) => void;
  onFocus: (cellIndex: number) => void;
};

const tileNameByCell = { a: "四角", b: "丸" } as const;

function getAccessibleName(
  size: number,
  cellIndex: number,
  view: TakuzuCellView,
  lineViolationNames: readonly string[],
): string {
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  const content = view.cell === null ? "空き" : tileNameByCell[view.cell];
  const qualifiers = [
    view.given ? "固定" : null,
    view.inViolatingRun ? "3連続" : null,
    ...lineViolationNames,
  ].filter((qualifier) => qualifier !== null);
  return [`${row + 1}行${column + 1}列`, content, ...qualifiers].join(" ");
}

export function TakuzuCell({
  size,
  cellIndex,
  view,
  lineViolationNames,
  disabled,
  focusable,
  onElementChange,
  onCycle,
  onFocus,
}: TakuzuCellProps) {
  const lastPointerTypeRef = useRef<string | null>(null);
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  const buttonRef = useCallback(
    (element: HTMLButtonElement | null) => onElementChange(cellIndex, element),
    [cellIndex, onElementChange],
  );

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    lastPointerTypeRef.current = event.pointerType;
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    // タッチの長押しでも contextmenu が届く環境があるため、逆方向の巡回はマウスの右クリックに限る。
    if (!disabled && lastPointerTypeRef.current !== "touch") {
      onCycle(cellIndex, "backward");
    }
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={getAccessibleName(size, cellIndex, view, lineViolationNames)}
      aria-disabled={view.given || undefined}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onCycle(cellIndex, "forward")}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onFocus={() => onFocus(cellIndex)}
      data-violated={view.inViolatingRun || undefined}
      className={cn(
        "group relative flex min-h-0 min-w-0 touch-manipulation select-none items-center justify-center bg-background outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground/70 disabled:cursor-default enabled:not-aria-disabled:hover:bg-accent/60 enabled:not-aria-disabled:active:bg-accent",
        row !== size - 1 && "border-b border-b-border",
        column !== size - 1 && "border-r border-r-border",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0",
          violationMarkTimingClassName,
          runViolationCellClassName,
        )}
      />
      {/*
        固定マスを押したときの揺れと完成の波は、格子を崩さないよう中のタイルだけに掛ける。
        タイルは常に独立した合成レイヤーに置く。動くときだけレイヤーに上がると、後ろに描くマスがまとめて
        レイヤーに分け直され、ほかのタイルが小数ピクセルずれて描き直されるため、動きの始まりと終わりに盤面全体が揺れて見える。
      */}
      <span
        data-takuzu-tile=""
        data-clear-wave-step={row + column}
        className="relative size-[80%] will-change-transform"
      >
        <TakuzuCellFace
          key={view.cell}
          cell={view.cell}
          given={view.given}
          size="board"
        />
      </span>
    </button>
  );
}
