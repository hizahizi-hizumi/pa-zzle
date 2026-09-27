import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import { TakuzuCellFace } from "@/games/takuzu/ui/board/TakuzuCellFace";
import {
  lineViolationBarClassName,
  runViolationCellClassName,
} from "@/games/takuzu/ui/board/violation-mark-style";
import { cn } from "@/lib/utils";

/**
 * 盤面と同じ見え方で描く、遊び方の小さな図。
 * `rows` の1文字が1マス。`A` / `B` は固定タイル、`a` / `b` は置いたタイル、`.` は空き。
 * `violation` は盤面と同じ違反の印を付ける。`run` はすべてのマスを3連続として、`line` は各行を行の違反として示す。
 */
type HowToPlayFigureProps = {
  rows: readonly string[];
  violation?: "run" | "line";
};

type FigureCell = {
  key: string;
  cell: TakuzuCell;
  given: boolean;
  lineEdge: "start" | "end" | null;
};

function toFigureCells(rows: readonly string[]): FigureCell[] {
  return rows.flatMap(function toRowCells(marks, row) {
    return Array.from(marks, function toFigureCell(mark, column): FigureCell {
      const tile = mark.toLowerCase();
      return {
        key: `${row}:${column}`,
        cell: tile === "a" || tile === "b" ? tile : null,
        given: mark === "A" || mark === "B",
        lineEdge:
          column === 0 ? "start" : column === marks.length - 1 ? "end" : null,
      };
    });
  });
}

const lineBarPlacementClassNames = {
  start: "right-[calc(100%+6px)]",
  end: "left-[calc(100%+6px)]",
} as const;

export function HowToPlayFigure({ rows, violation }: HowToPlayFigureProps) {
  const columnCount = rows[0]?.length ?? 0;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-grid gap-px border-2 border-foreground/55 bg-border",
        violation === "line" && "mx-2",
      )}
      style={{ gridTemplateColumns: `repeat(${columnCount}, 1.5rem)` }}
    >
      {toFigureCells(rows).map(function renderCell({
        key,
        cell,
        given,
        lineEdge,
      }) {
        return (
          <span
            key={key}
            className={cn(
              "relative flex size-6 items-center justify-center bg-background",
              violation === "run" && runViolationCellClassName,
            )}
          >
            <span className="size-[80%]">
              <TakuzuCellFace cell={cell} given={given} size="figure" />
            </span>
            {violation === "line" && lineEdge !== null ? (
              <span
                className={cn(
                  "absolute top-1/4 bottom-1/4 w-0.5",
                  lineBarPlacementClassNames[lineEdge],
                  lineViolationBarClassName,
                )}
              />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
