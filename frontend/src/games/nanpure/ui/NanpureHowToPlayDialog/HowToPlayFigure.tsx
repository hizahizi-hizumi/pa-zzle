import type { NanpureDigit } from "@/games/nanpure/puzzle/board";
import { NanpureCellNotes } from "@/games/nanpure/ui/board/NanpureCellNotes";
import { nanpureCellToneClassNames } from "@/games/nanpure/ui/board/nanpure-cell-tone";
import { cn } from "@/lib/utils";

/**
 * 遊び方の図の1マス。`given` は最初からある数字、それ以外の `digit` は入れた数字。
 * `digit` が無いマスは `notes` をメモとして描く。`highlight` は選択に伴う地の色、`error` は誤りの印。
 */
export type HowToPlayFigureCell = {
  digit?: NanpureDigit;
  given?: boolean;
  notes?: readonly NanpureDigit[];
  highlight?: "selected" | "related";
  error?: "mistake" | "conflict";
};

type HowToPlayFigureProps = {
  rows: readonly (readonly HowToPlayFigureCell[])[];
};

const noNotes: readonly NanpureDigit[] = [];

type PositionedFigureCell = HowToPlayFigureCell & {
  key: string;
  bottomEdge: boolean;
  rightEdge: boolean;
};

function toPositionedCells(
  rows: HowToPlayFigureProps["rows"],
): PositionedFigureCell[] {
  return rows.flatMap(function toRowCells(cells, row) {
    return cells.map(
      function toPositionedCell(cell, column): PositionedFigureCell {
        return {
          ...cell,
          key: `${row}:${column}`,
          bottomEdge: row === rows.length - 1,
          rightEdge: column === cells.length - 1,
        };
      },
    );
  });
}

/** 盤面と同じ地・数字・メモの見え方で描く、遊び方の小さな図。 */
export function HowToPlayFigure({ rows }: HowToPlayFigureProps) {
  const columnCount = rows[0]?.length ?? 0;

  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 border-2 border-foreground/55 bg-background"
      style={{ gridTemplateColumns: `repeat(${columnCount}, 2.5rem)` }}
    >
      {toPositionedCells(rows).map(function renderCell({
        key,
        bottomEdge,
        rightEdge,
        digit,
        given = false,
        notes = noNotes,
        highlight,
        error,
      }) {
        return (
          <span
            key={key}
            className={cn(
              "flex size-10 items-center justify-center font-sans text-xl leading-none",
              !bottomEdge && "border-b border-b-border",
              !rightEdge && "border-r border-r-border",
              highlight !== undefined && nanpureCellToneClassNames[highlight],
              digit !== undefined &&
                (given
                  ? nanpureCellToneClassNames.clue
                  : nanpureCellToneClassNames.entered),
              error !== undefined && nanpureCellToneClassNames[error],
            )}
          >
            {digit ?? (
              <NanpureCellNotes
                notes={notes}
                selectedValue={null}
                size="figure"
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
