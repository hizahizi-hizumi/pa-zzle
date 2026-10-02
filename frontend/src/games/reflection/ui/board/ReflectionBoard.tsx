import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useRef,
  useState,
} from "react";

import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import type {
  ReflectionLaserView,
  ReflectionProgress,
} from "@/games/reflection/play/use-reflection-play";
import type { ReflectionBoard as ReflectionBoardState } from "@/games/reflection/puzzle/board";
import {
  isSameReflectionEntry,
  listReflectionEntries,
  type ReflectionClue,
  type ReflectionEntry,
} from "@/games/reflection/puzzle/laser";
import type { ReflectionSelection } from "@/games/reflection/session/session";
import {
  getReflectionBoardGridArea,
  getReflectionFigureExtent,
  getReflectionFigureTracks,
  listReflectionGridLines,
} from "@/games/reflection/ui/board/board-geometry";
import { ReflectionClearLight } from "@/games/reflection/ui/board/clear/ReflectionClearLight";
import { ReflectionCell } from "@/games/reflection/ui/board/ReflectionBoard/ReflectionCell";
import { ReflectionClueButton } from "@/games/reflection/ui/board/ReflectionBoard/ReflectionClueButton";
import { ReflectionLaserPath } from "@/games/reflection/ui/board/ReflectionLaserPath";
import { reflectionToneClassNames } from "@/games/reflection/ui/reflection-tone";
import { useTouchTap } from "@/games/reflection/ui/touch-tap";
import { cn } from "@/lib/utils";

type ReflectionBoardProps = {
  board: ReflectionBoardState;
  clues: readonly ReflectionClue[];
  /** 外周ヒントごとに、今の配置での光が一致しているか。並びは `clues` と同じ。 */
  clueMatches: readonly boolean[];
  selection: ReflectionSelection | null;
  laser: ReflectionLaserView | null;
  progress: ReflectionProgress;
  onTapCell: (cellIndex: number) => void;
  onTapClue: (entry: ReflectionEntry) => void;
  onRemovePiece: (cellIndex: number) => void;
  onClearAnimationComplete: () => void;
};

/**
 * キーボードで動く位置。外周ヒントと盤面を1つの格子として扱い、盤面の端から外へ進むと外周ヒントへ移る。
 * `row` / `column` は外周を含む格子上の位置で、四隅は使わない。
 */
type FocusPosition = { row: number; column: number };

const offsetByArrowKey: Readonly<
  Record<string, { rowOffset: number; columnOffset: number }>
> = {
  ArrowUp: { rowOffset: -1, columnOffset: 0 },
  ArrowDown: { rowOffset: 1, columnOffset: 0 },
  ArrowLeft: { rowOffset: 0, columnOffset: -1 },
  ArrowRight: { rowOffset: 0, columnOffset: 1 },
};

const removeKeys = new Set(["Backspace", "Delete"]);

function getCellFocusKey(cellIndex: number): string {
  return `cell:${cellIndex}`;
}

function getClueFocusKey({ side, index }: ReflectionEntry): string {
  return `clue:${side}:${index}`;
}

function getFocusKeyAt(
  size: number,
  { row, column }: FocusPosition,
): string | null {
  const last = size + 1;
  const onVerticalEdge = column === 0 || column === last;
  const onHorizontalEdge = row === 0 || row === last;
  if (onVerticalEdge && onHorizontalEdge) return null;
  if (row === 0) return getClueFocusKey({ side: "top", index: column - 1 });
  if (row === last) {
    return getClueFocusKey({ side: "bottom", index: column - 1 });
  }
  if (column === 0) return getClueFocusKey({ side: "left", index: row - 1 });
  if (column === last) {
    return getClueFocusKey({ side: "right", index: row - 1 });
  }
  return getCellFocusKey((row - 1) * size + (column - 1));
}

function getFocusPosition(size: number, key: string): FocusPosition {
  const [kind, first, second] = key.split(":");
  if (kind === "cell") {
    const cellIndex = Number(first);
    return {
      row: Math.floor(cellIndex / size) + 1,
      column: (cellIndex % size) + 1,
    };
  }
  const index = Number(second) + 1;
  switch (first) {
    case "top":
      return { row: 0, column: index };
    case "bottom":
      return { row: size + 1, column: index };
    case "left":
      return { row: index, column: 0 };
    default:
      return { row: index, column: size + 1 };
  }
}

function hasModifierKey(event: ReactKeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

/**
 * 盤面と、その四辺を囲む外周ヒント。外周ヒントを押した位置の光路を、罫線の上・ピースの下に重ねて描く。
 * 今の配置での光が一致している外周ヒントは、地の色で示す。
 * 盤面が揃うと全光路を描き、完成演出を終えたら `onClearAnimationComplete` を呼ぶ。
 */
export function ReflectionBoard({
  board,
  clues,
  clueMatches,
  selection,
  laser,
  progress,
  onTapCell,
  onTapClue,
  onRemovePiece,
  onClearAnimationComplete,
}: ReflectionBoardProps) {
  const { size } = board;
  const [focusableKey, setFocusableKey] = useState(getCellFocusKey(0));
  const elementRefs = useRef(new Map<string, HTMLButtonElement>());
  // マスと外周ヒントは隣り合うので、続けて押したときの click の捨て方を共有する。
  const { getTapHandlers } = useTouchTap();
  const entries = listReflectionEntries(size);
  const extent = getReflectionFigureExtent(size);
  const tracks = getReflectionFigureTracks(size);
  const gridLines = listReflectionGridLines(size);
  const playing = progress === "playing";
  const selectedCellIndex =
    selection?.type === "cell" ? selection.cellIndex : null;

  const handleElementChange = useCallback(
    (key: string, element: HTMLButtonElement | null) => {
      if (element) {
        elementRefs.current.set(key, element);
      } else {
        elementRefs.current.delete(key);
      }
    },
    [],
  );

  function moveFocus(rowOffset: number, columnOffset: number): void {
    const { row, column } = getFocusPosition(size, focusableKey);
    const next = getFocusKeyAt(size, {
      row: Math.min(size + 1, Math.max(0, row + rowOffset)),
      column: Math.min(size + 1, Math.max(0, column + columnOffset)),
    });
    if (next === null) return;
    setFocusableKey(next);
    elementRefs.current.get(next)?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (!playing || hasModifierKey(event)) return;

    const offset = offsetByArrowKey[event.key];
    if (offset) {
      event.preventDefault();
      moveFocus(offset.rowOffset, offset.columnOffset);
      return;
    }

    if (removeKeys.has(event.key) && focusableKey.startsWith("cell:")) {
      event.preventDefault();
      onRemovePiece(Number(focusableKey.slice("cell:".length)));
    }
  }

  return (
    <div
      className="relative isolate grid size-full [container-type:inline-size]"
      style={
        {
          gridTemplateColumns: tracks,
          gridTemplateRows: tracks,
          "--reflection-unit": `calc(100cqw / ${extent})`,
        } as CSSProperties
      }
      onKeyDown={handleKeyDown}
    >
      {/*
        重なり順は、盤面の地と外枠 < 罫線と光路 < マス（ピース・選択の印）とし、この要素の中の明示的な z-index で決める。
        盤面の地と外枠: 外枠は outline で盤面の外側に描く。border にするとマスが枠の内側に詰められ、
        外周ヒントと光路の座標（grid の列をそのまま等分した位置）からマスの中心がずれる。
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative z-0 bg-background outline-2 outline-foreground/55 outline-solid"
        style={getReflectionBoardGridArea(size)}
      />
      {/*
        罫線と光路は1つの図に、罫線・光路の順で描く。同じ SVG の中は文書順に描かれるので、罫線が光路の上に来ない。
        マスはこの図より上に重ね、ピースは背景色の縁で光路を切るので、光路がピースの形を隠さない。
      */}
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${extent} ${extent}`}
        className={cn(
          "pointer-events-none absolute inset-0 z-1 size-full",
          reflectionToneClassNames.laserText,
        )}
      >
        <g
          className="stroke-border"
          strokeWidth={1}
          shapeRendering="crispEdges"
        >
          {gridLines.map(function renderGridLine(line) {
            return (
              <line
                key={`${line.x1},${line.y1}`}
                {...line}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
        {laser ? (
          <ReflectionLaserPath
            size={size}
            entry={laser.entry}
            trace={laser.trace}
          />
        ) : null}
        {playing ? null : (
          <ReflectionClearLight
            board={board}
            active={progress === "clearing"}
            onComplete={onClearAnimationComplete}
          />
        )}
      </svg>
      <div
        role="group"
        aria-label={`${REFLECTION_DISPLAY_NAME}盤面`}
        // マスは地を持たず、光路の図より上でピースと選択の印だけを描く。
        className="relative z-2 grid"
        style={{
          ...getReflectionBoardGridArea(size),
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        {board.cells.map(function renderCell(cell, cellIndex) {
          const focusKey = getCellFocusKey(cellIndex);
          return (
            <ReflectionCell
              key={focusKey}
              size={size}
              cellIndex={cellIndex}
              cell={cell}
              selected={selectedCellIndex === cellIndex}
              disabled={!playing}
              focusable={focusKey === focusableKey}
              focusKey={focusKey}
              onElementChange={handleElementChange}
              tapHandlers={getTapHandlers(() => onTapCell(cellIndex))}
              onFocus={setFocusableKey}
            />
          );
        })}
      </div>
      {entries.map(function renderClue(entry, clueIndex) {
        const clue = clues[clueIndex];
        const focusKey = getClueFocusKey(entry);
        return clue ? (
          <ReflectionClueButton
            key={focusKey}
            size={size}
            entry={entry}
            clue={clue}
            selected={
              laser !== null && isSameReflectionEntry(laser.entry, entry)
            }
            matched={clueMatches[clueIndex] ?? false}
            laserResult={
              laser !== null && isSameReflectionEntry(laser.entry, entry)
                ? laser.trace
                : null
            }
            disabled={!playing}
            focusable={focusKey === focusableKey}
            focusKey={focusKey}
            onElementChange={handleElementChange}
            tapHandlers={getTapHandlers(() => onTapClue(entry))}
            onFocus={setFocusableKey}
          />
        ) : null;
      })}
    </div>
  );
}
