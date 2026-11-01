import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";

import { NONOGRAM_DISPLAY_NAME } from "@/games/nonogram/display-name";
import {
  listNonogramLines,
  type NonogramBoard as NonogramBoardState,
} from "@/games/nonogram/puzzle/board";
import type { NonogramClues } from "@/games/nonogram/puzzle/clue";
import type { NonogramLineFlags } from "@/games/nonogram/puzzle/rules";
import type {
  NonogramMark,
  NonogramStrokeRange,
} from "@/games/nonogram/session/session";
import { NonogramCell } from "@/games/nonogram/ui/board/NonogramBoard/NonogramCell";
import { NonogramClue } from "@/games/nonogram/ui/board/NonogramBoard/NonogramClue";
import { NonogramGridLines } from "@/games/nonogram/ui/board/NonogramBoard/NonogramGridLines";

type NonogramBoardProps = {
  board: NonogramBoardState;
  clues: NonogramClues;
  matchedLines: NonogramLineFlags;
  strokeRange: NonogramStrokeRange | null;
  /** タップ・ドラッグ・キーボードで入れる印。 */
  mark: NonogramMark;
  interactionDisabled: boolean;
  /** クリアして図柄を見せている。格子と × を消す。 */
  revealed: boolean;
  onStartStroke: (cellIndex: number, mark: NonogramMark) => void;
  onExtendStroke: (cellIndex: number) => void;
  onEndStroke: () => void;
};

/** ヒントの数字1つが取る幅・高さ（マスの辺に対する比）。 */
const CLUE_NUMBER_EXTENT = 0.6;
/** ヒントと盤面の間（マスの辺に対する比）。 */
const CLUE_GAP_EXTENT = 0.3;
/** 広い画面でもマスをこれより大きくしない。 */
const MAXIMUM_CELL_SIZE = "4rem";

const offsetByArrowKey: Readonly<
  Record<string, { rowOffset: number; columnOffset: number }>
> = {
  ArrowUp: { rowOffset: -1, columnOffset: 0 },
  ArrowDown: { rowOffset: 1, columnOffset: 0 },
  ArrowLeft: { rowOffset: 0, columnOffset: -1 },
  ArrowRight: { rowOffset: 0, columnOffset: 1 },
};

/** 右クリックは、今の印によらず × を入れる。 */
const SECONDARY_MOUSE_BUTTON = 2;

function countClueNumbers(lines: NonogramClues["rows"]): number {
  return Math.max(1, ...lines.map((clue) => clue.length));
}

function scaleCell(extent: number): string {
  return `calc(var(--nonogram-cell) * ${extent})`;
}

/**
 * 盤面とヒントを、画面（`container-type: size` の親）の幅と高さの両方に収まる最大のマスの大きさで描く。
 * マスの大きさは、盤面の列・行の数に、ヒントの数字が最も多い行・列の分を足した数で割って決める。
 */
function createBoardLayoutStyle(
  { width, height }: NonogramBoardState,
  clues: NonogramClues,
): CSSProperties {
  const rowClueExtent =
    countClueNumbers(clues.rows) * CLUE_NUMBER_EXTENT + CLUE_GAP_EXTENT;
  const columnClueExtent =
    countClueNumbers(clues.columns) * CLUE_NUMBER_EXTENT + CLUE_GAP_EXTENT;
  return {
    "--nonogram-cell": `min(calc(100cqw / ${width + rowClueExtent}), calc(100cqh / ${height + columnClueExtent}), ${MAXIMUM_CELL_SIZE})`,
    gridTemplateColumns: `${scaleCell(rowClueExtent)} ${scaleCell(width)}`,
    gridTemplateRows: `${scaleCell(columnClueExtent)} ${scaleCell(height)}`,
  } as CSSProperties;
}

/** 盤面の要素の中の位置から、その位置のマス。盤面の外は最も近い端のマスにする。 */
function findCellIndexAt(
  element: HTMLElement,
  { width, height }: NonogramBoardState,
  clientX: number,
  clientY: number,
): number {
  const rect = element.getBoundingClientRect();
  const column = Math.floor(((clientX - rect.left) / rect.width) * width);
  const row = Math.floor(((clientY - rect.top) / rect.height) * height);
  const clampedColumn = Math.min(width - 1, Math.max(0, column));
  const clampedRow = Math.min(height - 1, Math.max(0, row));
  return clampedRow * width + clampedColumn;
}

function findPressedCellIndex(target: EventTarget): number | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const cell = target.closest<HTMLElement>("[data-cell-index]");
  return cell ? Number(cell.dataset.cellIndex) : null;
}

function hasModifierKey(event: ReactKeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function NonogramBoard({
  board,
  clues,
  matchedLines,
  strokeRange,
  mark,
  interactionDisabled,
  revealed,
  onStartStroke,
  onExtendStroke,
  onEndStroke,
}: NonogramBoardProps) {
  const { width, height } = board;
  const [focusableCellIndex, setFocusableCellIndex] = useState(0);
  const [keyboardCellIndex, setKeyboardCellIndex] = useState<number | null>(
    null,
  );
  const activePointerRef = useRef<{
    pointerId: number;
    cellIndex: number;
  } | null>(null);
  const cellElementRefs = useRef(new Map<number, HTMLButtonElement>());

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

  // 別の問題で盤面が小さくなっても、フォーカスを受けるマスを盤面の中に保つ。
  const focusableIndex = Math.min(focusableCellIndex, board.cells.length - 1);
  const activeCellIndex = strokeRange?.endCellIndex ?? keyboardCellIndex;
  const activeRow =
    activeCellIndex === null ? null : Math.floor(activeCellIndex / width);
  const activeColumn =
    activeCellIndex === null ? null : activeCellIndex % width;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    const isMouse = event.pointerType === "mouse";
    if (
      interactionDisabled ||
      !event.isPrimary ||
      activePointerRef.current !== null ||
      (isMouse && event.button !== 0 && event.button !== SECONDARY_MOUSE_BUTTON)
    ) {
      return;
    }
    const cellIndex = findPressedCellIndex(event.target);
    if (cellIndex === null) {
      return;
    }

    // マウスでマスへフォーカスが移ると、キーボードで選んでいるマスとして行・列を示してしまうため移さない。
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    activePointerRef.current = { pointerId: event.pointerId, cellIndex };
    setKeyboardCellIndex(null);
    onStartStroke(
      cellIndex,
      isMouse && event.button === SECONDARY_MOUSE_BUTTON ? "crossed" : mark,
    );
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const activePointer = activePointerRef.current;
    if (activePointer?.pointerId !== event.pointerId) {
      return;
    }
    const cellIndex = findCellIndexAt(
      event.currentTarget,
      board,
      event.clientX,
      event.clientY,
    );
    if (cellIndex === activePointer.cellIndex) {
      return;
    }
    activePointerRef.current = { ...activePointer, cellIndex };
    onExtendStroke(cellIndex);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>): void {
    if (activePointerRef.current?.pointerId !== event.pointerId) {
      return;
    }
    activePointerRef.current = null;
    onEndStroke();
  }

  function handleKeyboardPress(cellIndex: number): void {
    onStartStroke(cellIndex, mark);
    onEndStroke();
  }

  function handleCellFocus(cellIndex: number, focusVisible: boolean): void {
    setFocusableCellIndex(cellIndex);
    setKeyboardCellIndex(focusVisible ? cellIndex : null);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const offset = offsetByArrowKey[event.key];
    if (interactionDisabled || hasModifierKey(event) || !offset) {
      return;
    }
    event.preventDefault();
    const row = Math.floor(focusableIndex / width);
    const column = focusableIndex % width;
    const nextRow = Math.min(height - 1, Math.max(0, row + offset.rowOffset));
    const nextColumn = Math.min(
      width - 1,
      Math.max(0, column + offset.columnOffset),
    );
    cellElementRefs.current.get(nextRow * width + nextColumn)?.focus();
  }

  return (
    <div
      className="grid touch-none select-none [-webkit-touch-callout:none]"
      style={createBoardLayoutStyle(board, clues)}
    >
      <div aria-hidden="true" />
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
      >
        {listNonogramLines(board)
          .filter((line) => line.axis === "column")
          .map((line) => (
            <NonogramClue
              key={`column:${line.index}`}
              line={line}
              clue={clues.columns[line.index] ?? []}
              matched={matchedLines.columns[line.index] ?? false}
              active={line.index === activeColumn}
            />
          ))}
      </div>
      <div
        className="grid"
        style={{ gridTemplateRows: `repeat(${height}, minmax(0, 1fr))` }}
      >
        {listNonogramLines(board)
          .filter((line) => line.axis === "row")
          .map((line) => (
            <NonogramClue
              key={`row:${line.index}`}
              line={line}
              clue={clues.rows[line.index] ?? []}
              matched={matchedLines.rows[line.index] ?? false}
              active={line.index === activeRow}
            />
          ))}
      </div>
      <div
        role="group"
        aria-label={`${NONOGRAM_DISPLAY_NAME}盤面`}
        className="relative grid bg-background"
        style={{
          gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${height}, minmax(0, 1fr))`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        onBlur={() => setKeyboardCellIndex(null)}
      >
        {board.cells.map(function renderCell(state, cellIndex) {
          const row = Math.floor(cellIndex / width);
          const column = cellIndex % width;
          return (
            <NonogramCell
              key={`${row}:${column}`}
              cellIndex={cellIndex}
              row={row}
              column={column}
              state={state}
              revealed={revealed}
              disabled={interactionDisabled}
              focusable={cellIndex === focusableIndex}
              onElementChange={handleCellElementChange}
              onKeyboardPress={handleKeyboardPress}
              onFocus={handleCellFocus}
            />
          );
        })}
        <NonogramGridLines width={width} height={height} revealed={revealed} />
      </div>
    </div>
  );
}
