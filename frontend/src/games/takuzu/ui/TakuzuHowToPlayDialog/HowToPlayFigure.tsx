import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import "@/games/takuzu/ui/board/takuzu-board.css";
import {
  lineViolationBarClassName,
  runViolationCellClassName,
} from "@/games/takuzu/ui/board/violation-mark-style";
import { cn } from "@/lib/utils";

type HowToPlayFigureProps = {
  /** 1文字が1マス。`A` / `B` は固定タイル、`a` / `b` は置いたタイル、`.` は空き。 */
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
        "takuzu-howto-figure relative inline-grid gap-px border-2 border-foreground/55 bg-border",
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
            data-given={given || undefined}
            data-cell={cell ?? "empty"}
            data-run-warning={violation === "run" || undefined}
            className={cn(
              "takuzu-howto-cell relative flex size-6 items-center justify-center",
              violation === "run" && runViolationCellClassName,
            )}
          >
            {cell !== null && (
              <span className="takuzu-howto-digit" aria-hidden="true">
                {cell === "a" ? "0" : "1"}
              </span>
            )}
            {violation === "line" && lineEdge !== null ? (
              <span
                data-takuzu-line-warning=""
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
