import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";

import {
  getTakuzuCellPosition,
  listTakuzuLines,
  type TakuzuCell as TakuzuCellValue,
  type TakuzuLine,
} from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import { animateGivenCellRejection } from "@/games/takuzu/ui/board/animate-given-cell-rejection";
import {
  takuzuBoardFrameClassName,
  takuzuCellSurfaceClassName,
} from "@/games/takuzu/ui/board/board-surface-style";
import { listTakuzuLineViolationNames } from "@/games/takuzu/ui/board/cell-accessible-name";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import {
  type TakuzuArrowKeyMove,
  takuzuArrowKeys,
  takuzuPlacementKeys,
} from "@/games/takuzu/ui/board/keyboard-input";
import { TakuzuCell } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuCell";
import { TakuzuLineViolationMark } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuLineViolationMark";
import { cn } from "@/lib/utils";

type TakuzuBoardProps = {
  size: number;
  cells: readonly TakuzuCellView[];
  lineViolations: readonly TakuzuLineViolationView[];
  operation: TakuzuOperation | null;
  interactionDisabled: boolean;
  /** 通常のプレイでは渡さない。 */
  cues?: readonly TakuzuCellCue[];
  /** 通常のプレイでは渡さない。 */
  spotlight?: TakuzuBoardSpotlight | null;
  onCycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
  onPlaceCell: (cellIndex: number, cell: TakuzuCellValue) => void;
};

export type TakuzuBoardSpotlight = {
  /** 次に置くマスと、そのタイルを決めるマス。 */
  cellIndices: readonly number[];
  /** 個数超過・重複の行・列の、縁の外の印も抜くか。 */
  lineViolations: boolean;
};

const cellByInputKey: ReadonlyMap<string, TakuzuCellValue> = new Map(
  takuzuPlacementKeys.map(({ key, cell }) => [key, cell]),
);

const offsetByArrowKey: ReadonlyMap<string, TakuzuArrowKeyMove> = new Map(
  takuzuArrowKeys.map((move) => [move.key, move]),
);

function getCellKey(size: number, cellIndex: number): string {
  const { row, column } = getTakuzuCellPosition(size, cellIndex);
  return `${row}:${column}`;
}

function getLineKey({ axis, index }: TakuzuLine): string {
  return `${axis}:${index}`;
}

function hasModifierKey(event: ReactKeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function TakuzuBoard({
  size,
  cells,
  lineViolations,
  operation,
  interactionDisabled,
  cues = [],
  spotlight = null,
  onCycleCell,
  onPlaceCell,
}: TakuzuBoardProps) {
  const [focusableCellIndex, setFocusableCellIndex] = useState(0);
  const cellElementRefs = useRef(new Map<number, HTMLButtonElement>());
  const lineViolationByKey = new Map(
    lineViolations.map((violation) => [getLineKey(violation), violation]),
  );
  const cueByCellIndex = new Map(cues.map((cue) => [cue.cellIndex, cue]));

  useLayoutEffect(() => {
    if (operation?.type === "invalid") {
      animateGivenCellRejection(
        cellElementRefs.current.get(operation.cellIndex),
      );
    }
  }, [operation]);

  const handleCellElementChange = useCallback(
    (cellIndex: number, element: HTMLButtonElement | null) => {
      if (element) {
        cellElementRefs.current.set(cellIndex, element);
      } else {
        cellElementRefs.current.delete(cellIndex);
      }
    },
    [],
  );

  function moveFocus(
    cellIndex: number,
    rowOffset: number,
    columnOffset: number,
  ): void {
    const { row, column } = getTakuzuCellPosition(size, cellIndex);
    const nextRow = Math.min(size - 1, Math.max(0, row + rowOffset));
    const nextColumn = Math.min(size - 1, Math.max(0, column + columnOffset));
    const nextCellIndex = nextRow * size + nextColumn;
    setFocusableCellIndex(nextCellIndex);
    cellElementRefs.current.get(nextCellIndex)?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (interactionDisabled || hasModifierKey(event)) {
      return;
    }

    const offset = offsetByArrowKey.get(event.key);
    if (offset) {
      event.preventDefault();
      moveFocus(focusableCellIndex, offset.rowOffset, offset.columnOffset);
      return;
    }

    if (!cellByInputKey.has(event.key)) {
      return;
    }
    event.preventDefault();
    onPlaceCell(focusableCellIndex, cellByInputKey.get(event.key) ?? null);
  }

  return (
    // 行・列の違反の印を盤面の縁の外に置くため、盤面の周りに余白を取る。
    <div className="size-full p-3">
      <div
        role="group"
        aria-label={`${TAKUZU_DISPLAY_NAME}盤面`}
        className={cn(
          "relative grid size-full",
          takuzuBoardFrameClassName,
          takuzuCellSurfaceClassName,
        )}
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
        onKeyDown={handleKeyDown}
      >
        {cells.map(function renderCell(view, cellIndex) {
          const { row, column } = getTakuzuCellPosition(size, cellIndex);
          return (
            <TakuzuCell
              key={getCellKey(size, cellIndex)}
              size={size}
              cellIndex={cellIndex}
              view={view}
              lineViolationNames={[
                ...listTakuzuLineViolationNames(
                  lineViolationByKey.get(
                    getLineKey({ axis: "row", index: row }),
                  ),
                ),
                ...listTakuzuLineViolationNames(
                  lineViolationByKey.get(
                    getLineKey({ axis: "column", index: column }),
                  ),
                ),
              ]}
              disabled={interactionDisabled}
              cue={cueByCellIndex.get(cellIndex)}
              spotlit={spotlight?.cellIndices.includes(cellIndex) ?? false}
              focusable={cellIndex === focusableCellIndex}
              onElementChange={handleCellElementChange}
              onCycle={onCycleCell}
              onFocus={setFocusableCellIndex}
            />
          );
        })}
        {listTakuzuLines(size).map(function renderLineMark(line) {
          return (
            <TakuzuLineViolationMark
              key={getLineKey(line)}
              size={size}
              line={line}
              violated={lineViolationByKey.has(getLineKey(line))}
              spotlit={spotlight?.lineViolations ?? false}
            />
          );
        })}
      </div>
    </div>
  );
}
