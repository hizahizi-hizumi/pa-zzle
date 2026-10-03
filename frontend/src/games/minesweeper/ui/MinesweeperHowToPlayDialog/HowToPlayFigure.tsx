import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import {
  getMinesweeperCellFaceClassName,
  MinesweeperCellFace,
} from "@/games/minesweeper/ui/board/MinesweeperCellFace";
import { cn } from "@/lib/utils";

/**
 * 盤面と同じ見え方で描く、遊び方の小さな図。
 * `rows` の1文字が1マス。`.` は未開示、`0`〜`8` は開いたマスの数字、`F` は旗、`*` は地雷、`x` は踏んだ地雷。
 * `pressed` は押すマスを `[行, 列]` で示し、枠で囲む。
 */
type HowToPlayFigureProps = {
  rows: readonly string[];
  pressed?: readonly [row: number, column: number];
};

function toVisibleCell(mark: string): MinesweeperVisibleCell {
  if (mark === ".") {
    return { state: "hidden" };
  }
  if (mark === "F") {
    return { state: "flagged" };
  }
  if (mark === "*") {
    return { state: "mine" };
  }
  if (mark === "x") {
    return { state: "steppedMine" };
  }
  if (/^[0-8]$/.test(mark)) {
    return { state: "revealed", adjacentMineCount: Number(mark) };
  }
  throw new Error(`Unknown minesweeper how-to-play figure mark: ${mark}`);
}

type FigureCell = {
  key: string;
  view: MinesweeperVisibleCell;
  pressed: boolean;
};

function toFigureCells(
  rows: readonly string[],
  pressed: HowToPlayFigureProps["pressed"],
): FigureCell[] {
  return rows.flatMap(function toRowCells(marks, row) {
    return Array.from(marks, function toFigureCell(mark, column): FigureCell {
      return {
        key: `${row}:${column}`,
        view: toVisibleCell(mark),
        pressed: pressed?.[0] === row && pressed[1] === column,
      };
    });
  });
}

export function HowToPlayFigure({ rows, pressed }: HowToPlayFigureProps) {
  const columnCount = rows[0]?.length ?? 0;

  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 border-t border-l border-slate-300 dark:border-slate-600"
      style={{ gridTemplateColumns: `repeat(${columnCount}, 1.5rem)` }}
    >
      {toFigureCells(rows, pressed).map(function renderCell(cell) {
        return (
          <span
            key={cell.key}
            className={cn(
              getMinesweeperCellFaceClassName(cell.view, "figure"),
              cell.pressed && "ring-2 ring-foreground/70 ring-inset",
            )}
          >
            <MinesweeperCellFace view={cell.view} size="figure" />
          </span>
        );
      })}
    </span>
  );
}
