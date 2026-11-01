import { parseNonogramBoard } from "@/games/nonogram/puzzle/board";
import type { NonogramClue } from "@/games/nonogram/puzzle/clue";
import { NonogramCellFace } from "@/games/nonogram/ui/board/NonogramCellFace";
import { listNonogramClueNumbers } from "@/games/nonogram/ui/clue-numbers";
import {
  type StrokeTrace,
  StrokeTraceOverlay,
} from "@/games/nonogram/ui/NonogramHowToPlayDialog/HowToPlayFigure/StrokeTraceOverlay";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

/**
 * 盤面と同じ見え方で描く、遊び方の小さな図。
 * `rows` の1文字が1マスで、`#` が塗り、`x` が ×、`.` が未確定。
 * `rowClues` を渡すと各行の左に行ヒントを、`columnClues` を渡すと各列の上に列ヒントを添え、
 * `matchedRows`・`matchedColumns` の行・列のヒントを盤面と同じく薄くする。
 * `trace` を渡すと、押し始めたマスに点を置き、離したマスまでの道筋を矢印で重ねる。
 */
type HowToPlayFigureProps = {
  rows: readonly string[];
  rowClues?: readonly NonogramClue[];
  columnClues?: readonly NonogramClue[];
  matchedRows?: readonly boolean[];
  matchedColumns?: readonly boolean[];
  trace?: StrokeTrace;
};

const clueTextClassName = "font-sans text-sm font-semibold tabular-nums";

function selectClueToneClassName(matched: boolean | undefined): string {
  return matched
    ? nonogramToneClassNames.matchedClue
    : nonogramToneClassNames.clue;
}

export function HowToPlayFigure({
  rows,
  rowClues,
  columnClues,
  matchedRows,
  matchedColumns,
  trace,
}: HowToPlayFigureProps) {
  const board = parseNonogramBoard(rows);

  // ヒントの並びは、マスの間の線（`gap-px`）と盤面の外周（`border-2`）の分だけずらしてマスにそろえる。
  return (
    <span
      aria-hidden="true"
      className="inline-grid items-end gap-x-2 gap-y-1"
      style={{ gridTemplateColumns: rowClues ? "auto auto" : "auto" }}
    >
      {columnClues ? (
        <>
          {rowClues ? <span /> : null}
          <span
            className={cn("grid gap-px px-0.5", clueTextClassName)}
            style={{ gridTemplateColumns: `repeat(${board.width}, 1.5rem)` }}
          >
            {columnClues.map((clue, column) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: 列の位置で決まる
                key={column}
                className={cn(
                  "flex flex-col items-center justify-end",
                  selectClueToneClassName(matchedColumns?.[column]),
                )}
              >
                {listNonogramClueNumbers(clue).map((length, blockIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: ヒントの数字の並びで決まる
                  <span key={blockIndex}>{length}</span>
                ))}
              </span>
            ))}
          </span>
        </>
      ) : null}
      {rowClues ? (
        <span
          className={cn(
            "grid auto-rows-[1.5rem] gap-px py-0.5",
            clueTextClassName,
          )}
        >
          {rowClues.map((clue, row) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 行の位置で決まる
              key={row}
              className={cn(
                "flex items-center justify-end gap-1.5",
                selectClueToneClassName(matchedRows?.[row]),
              )}
            >
              {listNonogramClueNumbers(clue).map((length, blockIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: ヒントの数字の並びで決まる
                <span key={blockIndex}>{length}</span>
              ))}
            </span>
          ))}
        </span>
      ) : null}
      <span
        className={cn(
          "relative inline-grid gap-px border-2",
          nonogramToneClassNames.gridLineSurface,
          nonogramToneClassNames.blockLine,
        )}
        style={{ gridTemplateColumns: `repeat(${board.width}, 1.5rem)` }}
      >
        {board.cells.map((state, cellIndex) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: マスの位置で決まる
            key={cellIndex}
            className="relative size-6 bg-background"
          >
            <NonogramCellFace state={state} />
          </span>
        ))}
        {trace ? (
          <StrokeTraceOverlay
            trace={trace}
            boardWidth={board.width}
            boardHeight={board.height}
          />
        ) : null}
      </span>
    </span>
  );
}
