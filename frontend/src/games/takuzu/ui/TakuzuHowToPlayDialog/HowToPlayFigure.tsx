import { type CSSProperties, useState } from "react";

import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import type { TakuzuCell, TakuzuLine } from "@/games/takuzu/puzzle/board";
import {
  getNextTakuzuCell,
  type TakuzuCycleDirection,
} from "@/games/takuzu/puzzle/transitions";
import type { TakuzuLineViolationView } from "@/games/takuzu/session/session";
import {
  takuzuBoardFrameClassName,
  takuzuCellSurfaceClassName,
} from "@/games/takuzu/ui/board/board-surface-style";
import {
  getTakuzuCellAccessibleName,
  listTakuzuLineViolationNames,
} from "@/games/takuzu/ui/board/cell-accessible-name";
import {
  takuzuCellButtonClassName,
  takuzuCurrentCellClassName,
} from "@/games/takuzu/ui/board/cell-button-style";
import { TakuzuCellFace } from "@/games/takuzu/ui/board/TakuzuCellFace";
import { takuzuTileNames } from "@/games/takuzu/ui/board/tile-names";
import { useTakuzuCellSecondaryClick } from "@/games/takuzu/ui/board/use-cell-secondary-click";
import {
  lineViolationBarClassName,
  lineViolationBarPlacementClassNames,
  lineViolationTextClassName,
  runViolationCellClassName,
} from "@/games/takuzu/ui/board/violation-mark-style";
import {
  violationMarkImmediateTimingClassName,
  violationMarkTimingClassName,
} from "@/games/takuzu/ui/board/violation-mark-timing";
import {
  getTakuzuExampleMarks,
  listTakuzuExampleCells,
  listTakuzuExampleDifferingColumns,
  listTakuzuExampleOverfilledTileCells,
  type TakuzuExampleBoard,
  type TakuzuExampleMarks,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import { RowDifferenceBar } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/RowDifferenceBar";
import { cn } from "@/lib/utils";

/**
 * - `goal`: 入口のゴールの盤面。置き場所の幅（広い画面では幅と高さの小さい方）いっぱいに描き、盤面の縁を一文と面の端にそろえる。
 * - `example`: ルールや操作の例。どの図も、狭い画面では 40px（1行8マスが面に収まらない幅では収まる大きさ）、広い画面では 56px のマス（格子の線を含む）で描く。
 * - `inherited`: 押せない図を並べる置き場所が、収まるようにマスの大きさ（`--takuzu-figure-cell`）を決めて渡す図。
 */
export type HowToPlayFigureSize = "goal" | "example" | "inherited";

type HowToPlayFigureProps = {
  example: TakuzuExampleBoard;
  /**
   * 違反の印を求める姿。渡すと、印と読み上げ名の違反をこの姿から求め、待たずに出す。
   * 判定の言葉と同じ姿を渡し、印と言葉を同じ描画で替える。渡さなければ `example` から求め、本番と同じく待ってから出す。
   */
  markedExample?: TakuzuExampleBoard;
  size: HowToPlayFigureSize;
  /**
   * 押す所の手がかりを付けるマス。マスの内側の破線の枠と、押し方のアイコン（押す向きでは指、逆の向きではマウスの右ボタン）を、動かさずに描く。
   * 空きのマスでは、押すとなるタイルの形は置いたタイルに見えるので描かず、マウスを重ねたときだけ、その薄い姿を見せる。
   */
  pressedCells?: readonly number[];
  /**
   * 押せない図で、そのコマで押したマス。本番の盤面でキーボードで選んでいるマスと同じ地と輪郭で示す。
   * 押せる例の手がかり（破線の枠と指）とは見分けられ、押せそうには見せない。
   */
  currentCells?: readonly number[];
  /** 押す所を押す向き。手がかりのマスに、押すとなるタイルを、この向きで求める。 */
  pressDirection?: TakuzuCycleDirection;
  /**
   * 2行の例で、2つの行で違う列の真下（盤面の縁の外）に、見比べる所の短い線を引くか。
   * 本番の列の違反の印と同じ形と置き場所にし、色だけを文字の色にして、違反と見分けられるようにする。
   */
  marksRowDifferences?: boolean;
  /**
   * 行・列が置ける数を超えたときに、超えた方のタイルのマスを、判定に添える超えた数と同じ色の枠で囲むか。
   * 本番の行・列の印（縁の外の線）は変えずに足し、数えなくても多い方のタイルが見えるようにする。印と同じ間合いで出す。
   */
  marksOverfilledTiles?: boolean;
  /**
   * 渡すと、盤面をこの行数の盤面と同じ高さの場所の縦の中央に置く。行数の違う例を横に並べるときに、盤面の縦の中央をそろえる。
   */
  centeredInRowCount?: number;
  /** 図の外枠を、ほかの図より濃い色に替えて選んでいることを示すか。外側に線を足さず、外枠そのものの色だけを替える。 */
  outlined?: boolean;
  /** 押せない図を、読み上げで1枚の絵として伝えるときの名前。渡さない図は読み上げない。 */
  label?: string;
  /** 渡すと、マスを本番の盤面と同じく押せる（タップで進み、マウスの右クリックで戻る）。 */
  onTapCell?: (
    figureIndex: number,
    direction: TakuzuCycleDirection,
    element: HTMLElement,
  ) => void;
};

type LineEdge = "start" | "end";

/** 盤面の外枠の線の太さ。 */
const frameLineWidthPx = 2;

const outerBorderWidthPx = frameLineWidthPx * 2;

/** `rowCount` 行の盤面の高さ。マスと格子の線と外枠の線を足す。 */
function getBoardHeight(rowCount: number): string {
  return `calc(${rowCount} * var(--takuzu-figure-cell) + ${rowCount - 1 + outerBorderWidthPx}px)`;
}

/** マスの大きさ（格子の線の1px を除く）。 */
function getCellSizeStyle(
  size: HowToPlayFigureSize,
  columnCount: number,
): CSSProperties {
  if (size === "goal") {
    // 置き場所の幅と、置き場所の高さから盤面の下に取る段（見せ直すボタンと、遊び方の層が置くボタン）を除いた高さの、小さい方に合わせる。
    // 高さを渡さない置き場所では、高さは画面の高さになり、幅で決まる。
    const gapsPx = columnCount - 1 + outerBorderWidthPx;
    return {
      "--takuzu-figure-cell": `calc((min(100cqw, var(--how-to-play-goal-board-max, 100cqw), 100cqh - var(--takuzu-goal-reserved-block, 0px) - var(--how-to-play-goal-below, 0px)) - ${gapsPx}px) / ${columnCount})`,
    } as CSSProperties;
  }
  return {} as CSSProperties;
}

const cellSizeClassNames = {
  goal: "",
  example:
    "[--takuzu-figure-cell:min(39px,calc((100cqw-11px)/8))] lg:[--takuzu-figure-cell:55px]",
  inherited: "",
} as const satisfies Record<HowToPlayFigureSize, string>;

function getLineEdge(position: number, length: number): LineEdge | null {
  if (position === 0) {
    return "start";
  }
  return position === length - 1 ? "end" : null;
}

/** 押し方。押す向きでは指で押し、逆の向きではマウスの右ボタンで押す。 */
const pressGestures = {
  forward: "press",
  backward: "secondary-press",
} as const satisfies Record<TakuzuCycleDirection, string>;

function findLineViolation(
  marks: TakuzuExampleMarks,
  { axis, index }: TakuzuLine,
): TakuzuLineViolationView | undefined {
  function isSameLine(line: TakuzuLine): boolean {
    return line.axis === axis && line.index === index;
  }
  const overfilled = marks.overfilledLines.some(isSameLine);
  const duplicated = marks.duplicateLines.some(isSameLine);
  return overfilled || duplicated
    ? { axis, index, overfilled, duplicated }
    : undefined;
}

/**
 * 押せるマスの読み上げ名。本番の盤面のマスの読み上げ名に、遊び方だけの見せ方（押すとなるタイル、もう1行と違うこと）を添える。
 */
function getCellName({
  row,
  column,
  cell,
  given,
  marks,
  inRun,
  hintTile,
  differs,
}: {
  row: number;
  column: number;
  cell: TakuzuCell;
  given: boolean;
  marks: TakuzuExampleMarks;
  inRun: boolean;
  hintTile: TakuzuCell;
  differs: boolean;
}): string {
  const lineViolationNames = [
    ...listTakuzuLineViolationNames(
      findLineViolation(marks, { axis: "row", index: row }),
    ),
    ...listTakuzuLineViolationNames(
      findLineViolation(marks, { axis: "column", index: column }),
    ),
  ];
  return [
    getTakuzuCellAccessibleName(
      { row, column },
      { cell, given, inViolatingRun: inRun },
      lineViolationNames,
    ),
    hintTile === null ? null : `押すと${takuzuTileNames[hintTile]}`,
    differs ? "もう1行と違う" : null,
  ]
    .filter((part) => part !== null)
    .join(" ");
}

/**
 * 盤面と同じマス・タイル・違反の印で描く、遊び方の盤面。
 * 違反の印は本番の判定から求め、本番と同じ間合いで出す。行・列の印は盤面と同じく縁の外に出し、置き場所の余白に収める。
 */
export function HowToPlayFigure({
  example,
  markedExample,
  size,
  pressedCells = [],
  pressDirection = "forward",
  currentCells = [],
  marksRowDifferences = false,
  marksOverfilledTiles = false,
  centeredInRowCount,
  outlined = false,
  label,
  onTapCell,
}: HowToPlayFigureProps) {
  const { handlePointerDown, handleContextMenu } =
    useTakuzuCellSecondaryClick();
  const { rowCount, columnCount } = example;
  const marks = getTakuzuExampleMarks(markedExample ?? example);
  const markTimingClassName =
    markedExample === undefined
      ? violationMarkTimingClassName
      : violationMarkImmediateTimingClassName;
  const cells = listTakuzuExampleCells(example);
  const interactive = onTapCell !== undefined;
  // 最初の姿から変わったマスを覚える。変わったことのあるマスのタイルだけを現れさせ、最初の姿からあるタイルは、
  // 開いたとき・元に戻したとき（例を作り直す）・表示から外したタブへ戻ったときにも動かさない。
  const [initialCells] = useState(cells);
  const [changedCells, setChangedCells] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const newlyChangedCells = cells.flatMap(({ cell }, figureIndex) =>
    cell !== initialCells[figureIndex]?.cell && !changedCells.has(figureIndex)
      ? [figureIndex]
      : [],
  );
  if (newlyChangedCells.length > 0) {
    setChangedCells(new Set([...changedCells, ...newlyChangedCells]));
  }
  const differingColumns = marksRowDifferences
    ? listTakuzuExampleDifferingColumns(example)
    : [];
  const overfilledTileCells = marksOverfilledTiles
    ? listTakuzuExampleOverfilledTileCells(markedExample ?? example)
    : [];

  const grid = (
    <span
      aria-hidden={interactive || label !== undefined ? undefined : true}
      role={interactive ? "group" : label === undefined ? undefined : "img"}
      aria-label={interactive ? undefined : label}
      className={cn(
        // フォーカスの重なり順を図の中に閉じ、送られて上に留まるタブの列より前に出さない。
        "relative isolate inline-grid shrink-0 gap-px bg-border",
        takuzuBoardFrameClassName,
        outlined && "border-foreground",
      )}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, var(--takuzu-figure-cell))`,
      }}
    >
      {cells.map(function renderCell({ cell, given }, figureIndex) {
        const row = Math.floor(figureIndex / columnCount);
        const column = figureIndex % columnCount;
        const rowEdge = getLineEdge(column, columnCount);
        const columnEdge = getLineEdge(row, rowCount);
        const hinted = pressedCells.includes(figureIndex);
        // 最初からあるタイルは押しても変わらないので、押すとなるタイルを示さない。
        const hintTile =
          hinted && !given ? getNextTakuzuCell(cell, pressDirection) : null;
        const previewsHintTile = interactive && cell === null;
        const content = (
          <>
            {row === rowCount - 1 && differingColumns.includes(column) ? (
              <RowDifferenceBar placement="below-cell" />
            ) : null}
            <span
              data-violated={marks.runCells.includes(figureIndex) || undefined}
              className="group pointer-events-none absolute inset-0"
            >
              <span
                className={cn(
                  "absolute inset-0",
                  markTimingClassName,
                  runViolationCellClassName,
                )}
              />
            </span>
            {rowEdge !== null ? (
              <span
                data-violated={marks.violatedRows.includes(row) || undefined}
                className="group pointer-events-none absolute inset-0"
              >
                <span
                  className={cn(
                    "absolute",
                    lineViolationBarClassName,
                    lineViolationBarPlacementClassNames.row[rowEdge],
                    markTimingClassName,
                  )}
                />
              </span>
            ) : null}
            {columnEdge !== null ? (
              <span
                data-violated={
                  marks.violatedColumns.includes(column) || undefined
                }
                className="group pointer-events-none absolute inset-0"
              >
                <span
                  className={cn(
                    "absolute",
                    lineViolationBarClassName,
                    lineViolationBarPlacementClassNames.column[columnEdge],
                    markTimingClassName,
                  )}
                />
              </span>
            ) : null}
            {marksOverfilledTiles ? (
              <span
                data-violated={
                  overfilledTileCells.includes(figureIndex) || undefined
                }
                className="group pointer-events-none absolute inset-0"
              >
                <span
                  className={cn(
                    "absolute inset-px rounded-sm border-[1.5px] border-current",
                    lineViolationTextClassName,
                    markTimingClassName,
                  )}
                />
              </span>
            ) : null}
            <span
              data-takuzu-tile={given ? "given" : "placed"}
              data-clear-wave-step={row + column}
              className="relative size-[80%] will-change-transform"
            >
              <TakuzuCellFace
                key={cell}
                cell={cell}
                given={given}
                size={interactive || size === "goal" ? "board" : "figure"}
                settledOnMount={
                  !changedCells.has(figureIndex) &&
                  !newlyChangedCells.includes(figureIndex)
                }
              />
            </span>
            {hinted ? (
              // タイルのあるマスでは、タイルを隠さないよう指を右下の角に寄せる。
              <HowToPlayPressHint
                frame="inside"
                outline="square"
                pointer={cell === null ? "center" : "inside-corner"}
                gesture={pressGestures[pressDirection]}
                hoverPreview={
                  previewsHintTile && hintTile !== null ? (
                    <TakuzuCellFace
                      cell={hintTile}
                      given={false}
                      size="figure"
                    />
                  ) : undefined
                }
              />
            ) : null}
          </>
        );
        const cellClassName = cn(
          "relative flex aspect-square items-center justify-center",
          takuzuCellSurfaceClassName,
          currentCells.includes(figureIndex) && takuzuCurrentCellClassName,
        );
        if (!interactive) {
          return (
            <span key={`${row}:${column}`} className={cellClassName}>
              {content}
            </span>
          );
        }
        return (
          <button
            key={`${row}:${column}`}
            type="button"
            aria-label={getCellName({
              row,
              column,
              cell,
              given,
              marks,
              inRun: marks.runCells.includes(figureIndex),
              hintTile,
              differs: differingColumns.includes(column),
            })}
            aria-disabled={given || undefined}
            onClick={(event) =>
              onTapCell(figureIndex, "forward", event.currentTarget)
            }
            onContextMenu={(event) => {
              const element = event.currentTarget;
              handleContextMenu(event, () =>
                onTapCell(figureIndex, "backward", element),
              );
            }}
            onPointerDown={handlePointerDown}
            className={cn(cellClassName, takuzuCellButtonClassName)}
          >
            {content}
          </button>
        );
      })}
    </span>
  );

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center",
        cellSizeClassNames[size],
      )}
      style={{
        ...getCellSizeStyle(size, columnCount),
        ...(centeredInRowCount === undefined
          ? {}
          : { height: getBoardHeight(centeredInRowCount) }),
      }}
    >
      {grid}
    </span>
  );
}
