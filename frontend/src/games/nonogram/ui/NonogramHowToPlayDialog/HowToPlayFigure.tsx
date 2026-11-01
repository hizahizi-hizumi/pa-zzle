import { parseNonogramBoard } from "@/games/nonogram/puzzle/board";
import type { NonogramClue } from "@/games/nonogram/puzzle/clue";
import { NonogramCellFace } from "@/games/nonogram/ui/board/NonogramCellFace";
import { listNonogramClueNumbers } from "@/games/nonogram/ui/clue-numbers";
import { nonogramToneClassNames } from "@/games/nonogram/ui/nonogram-tone";
import { cn } from "@/lib/utils";

/**
 * 盤面と同じ見え方で描く、遊び方の小さな図。
 * `rows` の1文字が1マスで、`#` が塗り、`x` が ×、`.` が未確定。
 * `rowClues` を渡すと各行の左に行ヒントを添え、`matchedRows` の行のヒントを盤面と同じく薄くする。
 */
type HowToPlayFigureProps = {
  rows: readonly string[];
  rowClues?: readonly NonogramClue[];
  matchedRows?: readonly boolean[];
};

export function HowToPlayFigure({
  rows,
  rowClues,
  matchedRows,
}: HowToPlayFigureProps) {
  const board = parseNonogramBoard(rows);

  return (
    <span aria-hidden="true" className="inline-flex items-stretch gap-2">
      {rowClues ? (
        <span className="grid auto-rows-[1.5rem] font-sans text-sm font-semibold tabular-nums">
          {rowClues.map((clue, row) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 行の位置で決まる
              key={row}
              className={cn(
                "flex items-center justify-end gap-1.5",
                matchedRows?.[row]
                  ? nonogramToneClassNames.matchedClue
                  : nonogramToneClassNames.clue,
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
          "inline-grid gap-px border-2",
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
      </span>
    </span>
  );
}
