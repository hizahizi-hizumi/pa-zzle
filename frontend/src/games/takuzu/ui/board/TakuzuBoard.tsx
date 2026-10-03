import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getTakuzuCellPosition,
  listTakuzuGridLines,
  type TakuzuCell as TakuzuCellValue,
  type TakuzuLine,
} from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import { animateTakuzuTileRejection } from "@/games/takuzu/ui/board/TakuzuBoard/animate-tile-rejection";
import { TakuzuCell } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuCell";
import { TakuzuLineViolationMark } from "@/games/takuzu/ui/board/TakuzuBoard/TakuzuLineViolationMark";

type TakuzuBoardProps = {
  /** 本番の盤面は正方形。チュートリアルでは1行だけの盤面も描く。 */
  rowCount: number;
  columnCount: number;
  cells: readonly TakuzuCellView[];
  lineViolations: readonly TakuzuLineViolationView[];
  disabled: boolean;
  /** 操作する対象として示すマス。チュートリアルで指示したマスを示すのに使う。 */
  highlightedCellIndices?: readonly number[];
  /** マスに一時的に重ねる合図。通常のプレイでは渡さない。 */
  cues?: readonly TakuzuCellCue[];
  onCycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
  onPlaceCell: (cellIndex: number, cell: TakuzuCellValue) => void;
  /** 固定マスを押したとき。盤面は変えず、押したことだけを伝える。 */
  onPressGivenCell?: (cellIndex: number) => void;
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

const axisName = { row: "行", column: "列" } as const;

function getCellKey(columnCount: number, cellIndex: number): string {
  const { row, column } = getTakuzuCellPosition(columnCount, cellIndex);
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

export function TakuzuBoard({
  rowCount,
  columnCount,
  cells,
  lineViolations,
  disabled,
  highlightedCellIndices = [],
  cues = [],
  onCycleCell,
  onPlaceCell,
  onPressGivenCell,
}: TakuzuBoardProps) {
  const [focusableCellIndex, setFocusableCellIndex] = useState(0);
  const cellElementRefs = useRef(new Map<number, HTMLButtonElement>());
  const lineViolationByKey = new Map(
    lineViolations.map((violation) => [getLineKey(violation), violation]),
  );
  const cueByCellIndex = new Map(cues.map((cue) => [cue.cellIndex, cue]));
  const rejectedCue = cues.find((cue) => cue.kind === "rejected");
  const rejectedCueId = rejectedCue?.id ?? null;
  const rejectedCellIndex = rejectedCue?.cellIndex ?? null;

  // 揺れは DOM のアニメーションで描くので、合図が届いたときに要素へ掛ける。
  useEffect(() => {
    if (rejectedCueId === null || rejectedCellIndex === null) {
      return;
    }
    animateTakuzuTileRejection(cellElementRefs.current.get(rejectedCellIndex));
  }, [rejectedCueId, rejectedCellIndex]);

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

  function rejectGivenCell(cellIndex: number): void {
    animateTakuzuTileRejection(cellElementRefs.current.get(cellIndex));
    onPressGivenCell?.(cellIndex);
  }

  function handleCycle(
    cellIndex: number,
    direction: TakuzuCycleDirection,
  ): void {
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
  ): void {
    const { row, column } = getTakuzuCellPosition(columnCount, cellIndex);
    const nextRow = Math.min(rowCount - 1, Math.max(0, row + rowOffset));
    const nextColumn = Math.min(
      columnCount - 1,
      Math.max(0, column + columnOffset),
    );
    const nextCellIndex = nextRow * columnCount + nextColumn;
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
    // 行・列の違反の印を盤面の縁の外に置くため、盤面の周りに余白を取る。
    <div className="size-full p-3">
      <div
        role="group"
        aria-label="バイナリパズル盤面"
        className="relative grid size-full border-2 border-foreground/55 bg-background"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
        }}
        onKeyDown={handleKeyDown}
      >
        {cells.map(function renderCell(view, cellIndex) {
          const { row, column } = getTakuzuCellPosition(columnCount, cellIndex);
          return (
            <TakuzuCell
              key={getCellKey(columnCount, cellIndex)}
              rowCount={rowCount}
              columnCount={columnCount}
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
              disabled={disabled}
              highlighted={highlightedCellIndices.includes(cellIndex)}
              cue={cueByCellIndex.get(cellIndex)}
              focusable={cellIndex === focusableCellIndex}
              onElementChange={handleCellElementChange}
              onCycle={handleCycle}
              onFocus={setFocusableCellIndex}
            />
          );
        })}
        {listTakuzuGridLines({ rowCount, columnCount }).map(
          function renderLineMark(line) {
            return (
              <TakuzuLineViolationMark
                key={getLineKey(line)}
                rowCount={rowCount}
                columnCount={columnCount}
                line={line}
                violated={lineViolationByKey.has(getLineKey(line))}
              />
            );
          },
        )}
      </div>
    </div>
  );
}
