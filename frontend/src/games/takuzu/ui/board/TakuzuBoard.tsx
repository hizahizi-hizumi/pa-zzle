import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
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
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";
import {
  getNextTakuzuCell,
  type TakuzuCycleDirection,
} from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import { animateGivenCellRejection } from "@/games/takuzu/ui/board/TakuzuBoard/animate-given-cell-rejection";
import { playLineCompletionFlash } from "@/games/takuzu/ui/board/TakuzuBoard/line-completion-flash";
import { listTakuzuStrokeCellIndices } from "@/games/takuzu/ui/board/TakuzuBoard/stroke-path";
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
  /** なぞりの2マス目以降の空きマスに置く。渡さなければ、なぞって置かない。 */
  onStrokeCell?: (cellIndex: number, tile: TakuzuTile) => void;
};

/**
 * なぞっている指。`tile` はなぞり始めのマスを押したときに置いたタイルで、2マス目に入るまでは `undefined`。
 * `null` なら、なぞり始めのマスを空きにしたので、通ったマスには何も置かない。
 */
type TakuzuStroke = {
  pointerId: number;
  startCellIndex: number;
  lastCellIndex: number;
  tile: TakuzuCellValue | undefined;
};

/** なぞり終えて指を離したときに届くクリックを、なぞり始めのマスを押した操作として二重に受けない間。 */
const STROKE_CLICK_GUARD_MS = 400;

function findCellIndexAt(x: number, y: number): number | null {
  const element = document
    .elementFromPoint?.(x, y)
    ?.closest<HTMLElement>("[data-takuzu-cell-index]");
  const cellIndex = element?.dataset.takuzuCellIndex;
  return cellIndex === undefined ? null : Number(cellIndex);
}

export type TakuzuBoardSpotlight = {
  /** 次に置くマスと、そのタイルを決めるマス。 */
  cellIndices: readonly number[];
  /** 個数超過・重複の行・列の、縁の外の印も抜くか。 */
  lineViolations: boolean;
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
  onStrokeCell,
}: TakuzuBoardProps) {
  const [focusableCellIndex, setFocusableCellIndex] = useState(0);
  const cellElementRefs = useRef(new Map<number, HTMLButtonElement>());
  const boardRef = useRef<HTMLDivElement>(null);
  const strokeRef = useRef<TakuzuStroke | null>(null);
  const strokeEndedAtRef = useRef<number | null>(null);
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

  // 光らせている途中で次のタイルを置いても光を切らず、次の行・列が埋まったときだけ光らせ直す。
  const flashAnimationsRef = useRef<Animation[]>([]);
  useEffect(() => {
    const board = boardRef.current;
    if (
      !board ||
      operation?.type !== "placed" ||
      operation.completedLines.length === 0
    ) {
      return;
    }
    for (const animation of flashAnimationsRef.current) {
      animation.cancel();
    }
    flashAnimationsRef.current = playLineCompletionFlash(
      board,
      size,
      operation.completedLines,
    );
  }, [operation, size]);
  useEffect(() => {
    return function stopFlash() {
      for (const animation of flashAnimationsRef.current) {
        animation.cancel();
      }
    };
  }, []);

  function handleCellCycle(
    cellIndex: number,
    direction: TakuzuCycleDirection,
  ): void {
    const strokeEndedAt = strokeEndedAtRef.current;
    strokeEndedAtRef.current = null;
    if (
      strokeEndedAt !== null &&
      performance.now() - strokeEndedAt < STROKE_CLICK_GUARD_MS
    ) {
      return;
    }
    onCycleCell(cellIndex, direction);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    strokeEndedAtRef.current = null;
    if (interactionDisabled || !onStrokeCell || event.button !== 0) {
      return;
    }
    const cellIndex = findCellIndexAt(event.clientX, event.clientY);
    strokeRef.current =
      cellIndex === null
        ? null
        : {
            pointerId: event.pointerId,
            startCellIndex: cellIndex,
            lastCellIndex: cellIndex,
            tile: undefined,
          };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId || !onStrokeCell) {
      return;
    }
    // 盤面の外でマウスのボタンを離すと、盤面に離した知らせが届かない。
    if (event.buttons === 0) {
      handlePointerEnd(event);
      return;
    }
    const cellIndex = findCellIndexAt(event.clientX, event.clientY);
    if (cellIndex === null || cellIndex === stroke.lastCellIndex) {
      return;
    }
    if (stroke.tile === undefined) {
      const start = cells[stroke.startCellIndex];
      // 固定マスからはなぞらない。押した固定マスは、離したときに本番と同じく揺れで返す。
      if (!start || start.given) {
        strokeRef.current = null;
        return;
      }
      stroke.tile = getNextTakuzuCell(start.cell, "forward");
      strokeEndedAtRef.current = performance.now();
      onCycleCell(stroke.startCellIndex, "forward");
    }
    const tile = stroke.tile;
    if (tile !== null) {
      for (const passedCellIndex of listTakuzuStrokeCellIndices(
        size,
        stroke.lastCellIndex,
        cellIndex,
      )) {
        const passed = cells[passedCellIndex];
        if (passed && !passed.given && passed.cell === null) {
          onStrokeCell(passedCellIndex, tile);
        }
      }
    }
    stroke.lastCellIndex = cellIndex;
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>): void {
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId) {
      return;
    }
    strokeRef.current = null;
    if (stroke.tile !== undefined) {
      strokeEndedAtRef.current = performance.now();
    }
  }

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
    // 行・列の違反の印を盤面の縁の外に置くため、盤面の周りに余白を取る。
    <div className="size-full p-3">
      <div
        ref={boardRef}
        role="group"
        aria-label={`${TAKUZU_DISPLAY_NAME}盤面`}
        // なぞる指で画面がスクロールしないよう、盤面の上ではブラウザのタッチ操作を止める。
        className={cn(
          "relative grid size-full border-2 border-foreground/55 bg-background",
          onStrokeCell && "touch-none",
        )}
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
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
              focusable={cellIndex === focusableCellIndex}
              onElementChange={handleCellElementChange}
              onCycle={handleCellCycle}
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
