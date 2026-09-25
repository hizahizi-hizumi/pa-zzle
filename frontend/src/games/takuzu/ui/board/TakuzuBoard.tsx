import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getTakuzuCellPosition,
  type TakuzuCell as TakuzuCellValue,
} from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { TakuzuCell } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuCell";

type TakuzuBoardProps = {
  size: number;
  cells: readonly TakuzuCellView[];
  disabled: boolean;
  clearing: boolean;
  onCycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
  onPlaceCell: (cellIndex: number, cell: TakuzuCellValue) => void;
  onClearingComplete: () => void;
};

/** キーボードで直接置くキー。`1` と `2` は巡回の順（A → B）に合わせる。 */
const cellByInputKey: Readonly<Record<string, TakuzuCellValue>> = {
  "1": "a",
  "2": "b",
  "0": null,
  Backspace: null,
  Delete: null,
};

const offsetByArrowKey: Readonly<
  Record<string, { rowOffset: number; columnOffset: number }>
> = {
  ArrowUp: { rowOffset: -1, columnOffset: 0 },
  ArrowDown: { rowOffset: 1, columnOffset: 0 },
  ArrowLeft: { rowOffset: 0, columnOffset: -1 },
  ArrowRight: { rowOffset: 0, columnOffset: 1 },
};

const CLEAR_WAVE_STAGGER_MS = 35;
const CLEAR_WAVE_DURATION_MS = 380;
const CLEAR_SETTLE_MS = 240;

function getCellKey(size: number, cellIndex: number): string {
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  return `${row}:${column}`;
}

function hasModifierKey(event: ReactKeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function TakuzuBoard({
  size,
  cells,
  disabled,
  clearing,
  onCycleCell,
  onPlaceCell,
  onClearingComplete,
}: TakuzuBoardProps) {
  const [focusableCellIndex, setFocusableCellIndex] = useState(0);
  const cellElementRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    if (!clearing) {
      return;
    }

    const cellElements = Array.from({ length: size * size }, (_, cellIndex) =>
      cellElementRefs.current.get(cellIndex),
    );
    return animateClear(size, cellElements, onClearingComplete);
  }, [clearing, onClearingComplete, size]);

  function rejectGivenCell(cellIndex: number): void {
    animateGivenCell(cellElementRefs.current.get(cellIndex));
  }

  function handlePress(cellIndex: number, direction: TakuzuCycleDirection) {
    if (cells[cellIndex]?.given) {
      rejectGivenCell(cellIndex);
      return;
    }
    onCycleCell(cellIndex, direction);
  }

  function moveFocus(
    cellIndex: number,
    rowOffset: number,
    columnOffset: number,
  ) {
    const { row, column } = getTakuzuCellPosition(size, cellIndex);
    const nextRow = Math.min(size - 1, Math.max(0, row + rowOffset));
    const nextColumn = Math.min(size - 1, Math.max(0, column + columnOffset));
    const nextCellIndex = nextRow * size + nextColumn;
    setFocusableCellIndex(nextCellIndex);
    cellElementRefs.current.get(nextCellIndex)?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (disabled || hasModifierKey(event)) {
      return;
    }

    const offset = offsetByArrowKey[event.key];
    if (offset) {
      event.preventDefault();
      moveFocus(focusableCellIndex, offset.rowOffset, offset.columnOffset);
      return;
    }

    if (!Object.hasOwn(cellByInputKey, event.key)) {
      return;
    }
    event.preventDefault();
    if (cells[focusableCellIndex]?.given) {
      rejectGivenCell(focusableCellIndex);
      return;
    }
    onPlaceCell(focusableCellIndex, cellByInputKey[event.key] ?? null);
  }

  return (
    <div
      role="group"
      aria-label="盤面"
      className="grid size-full gap-[0.5%] rounded-[2.5%] bg-slate-300 p-[0.5%] dark:bg-slate-700"
      style={{
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
      }}
      onKeyDown={handleKeyDown}
    >
      {cells.map(function renderCell(view, cellIndex) {
        return (
          <TakuzuCell
            key={getCellKey(size, cellIndex)}
            size={size}
            cellIndex={cellIndex}
            view={view}
            disabled={disabled}
            focusable={cellIndex === focusableCellIndex}
            buttonRef={(element) => {
              if (element) {
                cellElementRefs.current.set(cellIndex, element);
              } else {
                cellElementRefs.current.delete(cellIndex);
              }
            }}
            onPress={(pressedCellIndex) =>
              handlePress(pressedCellIndex, "forward")
            }
            onPressBackward={(pressedCellIndex) =>
              handlePress(pressedCellIndex, "backward")
            }
            onFocus={setFocusableCellIndex}
          />
        );
      })}
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/** 固定マスは押しても変わらないことを、そのマスだけの小さな横揺れで返す。 */
function animateGivenCell(element: HTMLElement | undefined): void {
  if (!element?.animate || prefersReducedMotion()) {
    return;
  }

  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-6%)" },
      { transform: "translateX(6%)" },
      { transform: "translateX(-3%)" },
      { transform: "translateX(0)" },
    ],
    { duration: 220, easing: "ease-out" },
  );
}

/** 左上から右下へ、揃った盤面のマスを斜めの波で小さく持ち上げる。 */
function animateClear(
  size: number,
  cellElements: readonly (HTMLElement | undefined)[],
  onComplete: () => void,
): (() => void) | undefined {
  if (
    prefersReducedMotion() ||
    cellElements.some((element) => typeof element?.animate !== "function")
  ) {
    onComplete();
    return;
  }

  const animations = cellElements.map(function animateCell(element, cellIndex) {
    const { row, column } = getTakuzuCellPosition(size, cellIndex);
    return element?.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        {
          transform: "scale(1.12)",
          filter: "brightness(1.18)",
          offset: 0.4,
        },
        { transform: "scale(1)", filter: "brightness(1)" },
      ],
      {
        duration: CLEAR_WAVE_DURATION_MS,
        delay: (row + column) * CLEAR_WAVE_STAGGER_MS,
        easing: "cubic-bezier(.2,.8,.2,1)",
      },
    );
  });

  const lastDelayMs = (size - 1) * 2 * CLEAR_WAVE_STAGGER_MS;
  const timer = window.setTimeout(
    onComplete,
    lastDelayMs + CLEAR_WAVE_DURATION_MS + CLEAR_SETTLE_MS,
  );
  return () => {
    window.clearTimeout(timer);
    for (const animation of animations) {
      animation?.cancel();
    }
  };
}
