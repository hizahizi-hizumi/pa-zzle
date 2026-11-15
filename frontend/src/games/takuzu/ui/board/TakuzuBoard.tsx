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
  getTakuzuLineCellIndices,
  listTakuzuLines,
  type TakuzuCell as TakuzuCellValue,
  type TakuzuLine,
} from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import { animateGivenCellRejection } from "@/games/takuzu/ui/board/TakuzuBoard/animate-given-cell-rejection";
import { TakuzuCell } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuCell";
import "@fontsource/zen-kaku-gothic-new/latin-700.css";
import "@/games/takuzu/ui/board/takuzu-board.css";
import { TakuzuLineViolationMark } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuLineViolationMark";

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

/** 盤面表示と同じ 0・1 を直接入力する。 */
const cellByInputKey: Readonly<Record<string, TakuzuCellValue>> = {
  "0": "a",
  "1": "b",
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

const axisName = { row: "行", column: "列" } as const;

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

function listLineViolationNames(
  violation: TakuzuLineViolationView | undefined,
): string[] {
  if (!violation) {
    return [];
  }
  return [
    violation.overfilled ? `${axisName[violation.axis]}の個数超過` : null,
    violation.duplicated ? `${axisName[violation.axis]}の重複` : null,
  ].filter((name) => name !== null);
}

function isCompletedLine(
  size: number,
  cells: readonly TakuzuCellView[],
  line: TakuzuLine,
): boolean {
  const values = getTakuzuLineCellIndices(size, line).map(
    (index) => cells[index]?.cell ?? null,
  );
  if (values.some((value) => value === null)) {
    return false;
  }
  if (values.filter((value) => value === "a").length !== size / 2) {
    return false;
  }
  return values.every(
    (value, index) =>
      index < 2 || value !== values[index - 1] || value !== values[index - 2],
  );
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
  const [readingCellIndex, setReadingCellIndex] = useState<number | null>(null);
  const cellElementRefs = useRef(new Map<number, HTMLButtonElement>());
  const lines = listTakuzuLines(size);
  const lineViolationByKey = new Map(
    lineViolations.map((violation) => [getLineKey(violation), violation]),
  );
  const cueByCellIndex = new Map(cues.map((cue) => [cue.cellIndex, cue]));
  const indicatorLength = `calc((100% - 38px) / ${size} - 4px)`;
  const readingRow =
    readingCellIndex === null ? null : Math.floor(readingCellIndex / size);
  const readingColumn =
    readingCellIndex === null ? null : readingCellIndex % size;
  const completedLineKeys = new Set(
    lines
      .filter((line) => {
        return (
          !lineViolationByKey.has(getLineKey(line)) &&
          isCompletedLine(size, cells, line)
        );
      })
      .map(getLineKey),
  );

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
    onPlaceCell(focusableCellIndex, cellByInputKey[event.key] ?? null);
  }

  return (
    <div
      className="takuzu-board-shell size-full p-3"
      data-interaction-disabled={interactionDisabled || undefined}
    >
      <div
        role="group"
        aria-label={`${TAKUZU_DISPLAY_NAME}盤面`}
        className="takuzu-board-grid relative grid size-full border-2 border-foreground/55 bg-background"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setReadingCellIndex(null);
          }
        }}
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
                ...listLineViolationNames(
                  lineViolationByKey.get(
                    getLineKey({ axis: "row", index: row }),
                  ),
                ),
                ...listLineViolationNames(
                  lineViolationByKey.get(
                    getLineKey({ axis: "column", index: column }),
                  ),
                ),
              ]}
              disabled={interactionDisabled}
              cue={cueByCellIndex.get(cellIndex)}
              spotlit={spotlight?.cellIndices.includes(cellIndex) ?? false}
              reading={row === readingRow || column === readingColumn}
              selected={readingCellIndex === cellIndex}
              rowCompleted={completedLineKeys.has(
                getLineKey({ axis: "row", index: row }),
              )}
              columnCompleted={completedLineKeys.has(
                getLineKey({ axis: "column", index: column }),
              )}
              focusable={cellIndex === focusableCellIndex}
              onElementChange={handleCellElementChange}
              onCycle={onCycleCell}
              onFocus={(focusedIndex) => {
                setFocusableCellIndex(focusedIndex);
                setReadingCellIndex(focusedIndex);
              }}
            />
          );
        })}
        {lines.map(function renderLineMark(line) {
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
        {lines.map((line) => (
          <span
            key={`trace:${getLineKey(line)}`}
            aria-hidden="true"
            className={`takuzu-completion-trace takuzu-completion-trace--${line.axis}`}
            data-completed={
              completedLineKeys.has(getLineKey(line)) || undefined
            }
            style={
              line.axis === "row"
                ? {
                    gridRow: `${line.index + 1} / span 1`,
                    gridColumn: `1 / span ${size}`,
                  }
                : {
                    gridRow: `1 / span ${size}`,
                    gridColumn: `${line.index + 1} / span 1`,
                  }
            }
          />
        ))}
        <span aria-hidden="true" data-clear-aura="" />
      </div>
      {lines.map((line) => (
        <span
          key={getLineKey(line)}
          aria-hidden="true"
          data-completed={completedLineKeys.has(getLineKey(line)) || undefined}
          data-reading={
            (line.axis === "row" && line.index === readingRow) ||
            (line.axis === "column" && line.index === readingColumn) ||
            undefined
          }
          className={`takuzu-line-indicator takuzu-line-indicator--${line.axis}`}
          style={
            line.axis === "row"
              ? {
                  top: `calc(19px + (100% - 38px) * ${(line.index + 0.5) / size})`,
                  height: indicatorLength,
                }
              : {
                  left: `calc(19px + (100% - 38px) * ${(line.index + 0.5) / size})`,
                  width: indicatorLength,
                }
          }
        />
      ))}
    </div>
  );
}
