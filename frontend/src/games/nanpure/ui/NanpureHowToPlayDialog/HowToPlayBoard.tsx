import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import {
  getNanpureColumnIndex,
  getNanpureRowIndex,
  type NanpureBoard,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import { getNanpureCellAccessibleName } from "@/games/nanpure/ui/board/cell-accessible-name";
import { NanpureCellNotes } from "@/games/nanpure/ui/board/NanpureCellNotes";
import {
  getNanpureCellLineClassName,
  getNanpureCellSelectionRelation,
  getNanpureCellToneClassName,
  nanpureBoardFrameClassName,
  nanpureCellFocusClassName,
} from "@/games/nanpure/ui/board/nanpure-cell-tone";
import {
  listNanpureExampleCellIndices,
  type NanpureExampleRegion,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import { nanpurePressHintPlacement } from "@/games/nanpure/ui/NanpureHowToPlayDialog/press-hint-placement";
import { cn } from "@/lib/utils";

type HowToPlayBoardProps = {
  region: NanpureExampleRegion;
  board: NanpureBoard;
  clues: NanpureBoard;
  notes: NanpureNotes;
  /** この盤面で選んでいるマス。本番と同じく、選んだマスと、同じ行・列・ブロックのマスと、同じ数字のマスの地を変える。 */
  selectedCellIndex: number | null;
  conflictCellIndices: readonly number[];
  mistakeCellIndices: readonly number[];
  /** 次に押す所の手がかりを付けるマス。 */
  hintedCellIndex?: number | null;
  /** 渡すと、マスを本番の盤面と同じく押して選べる。 */
  onSelectCell?: (cellIndex: number) => void;
};

/** 本番の盤面のマスの数字とマスの大きさの比（マス約 41px に数字約 19.5px）にそろえる。 */
const digitSizeClassName = "text-[calc(var(--nanpure-figure-cell)*0.48)]";

/**
 * 本番の盤面と同じマス・線・数字の色・地で描く、9×9 の盤面の一部。マスの大きさは、置き場所が `--nanpure-figure-cell` で渡す。
 * 範囲の中の線は、本番と同じく、ブロックの境目だけを太線にする。範囲の外枠は本番の盤面の外枠と同じにする。
 * 本番の盤面と同じく、行・列・ブロックで重なった数字と、答えと違う数字の色を、今の盤面から出す。
 */
export function HowToPlayBoard({
  region,
  board,
  clues,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  mistakeCellIndices,
  hintedCellIndex = null,
  onSelectCell,
}: HowToPlayBoardProps) {
  const cellIndices = listNanpureExampleCellIndices(region);
  const lastRow = region.row + region.rowCount - 1;
  const lastColumn = region.column + region.columnCount - 1;
  const conflictCells = new Set(conflictCellIndices);
  const mistakeCells = new Set(mistakeCellIndices);
  const selectedValue =
    selectedCellIndex === null ? null : (board[selectedCellIndex] ?? null);
  const interactive = onSelectCell !== undefined;

  return (
    // 押せない図は読み上げない。押せる例は、本番の盤面と同じ読み上げ名のマスを並べた1つのまとまりにする。
    <span
      aria-hidden={interactive ? undefined : true}
      role={interactive ? "group" : undefined}
      data-nanpure-example-board=""
      className={cn(
        // フォーカスの重なり順を図の中に閉じ、送られて上に留まるタブの列より前に出さない。
        "relative isolate inline-grid shrink-0",
        nanpureBoardFrameClassName,
      )}
      style={{
        gridTemplateColumns: `repeat(${region.columnCount}, var(--nanpure-figure-cell))`,
      }}
    >
      {cellIndices.map((cellIndex) => {
        const row = getNanpureRowIndex(cellIndex);
        const column = getNanpureColumnIndex(cellIndex);
        const value = board[cellIndex] ?? null;
        const clue = clues[cellIndex] !== null;
        const cellNotes = notes[cellIndex] ?? [];
        const relation = getNanpureCellSelectionRelation(
          board,
          selectedCellIndex,
          cellIndex,
        );
        const conflict = conflictCells.has(cellIndex);
        const mistake = mistakeCells.has(cellIndex);
        const className = cn(
          "relative flex aspect-square items-center justify-center font-sans leading-none outline-none transition-colors",
          digitSizeClassName,
          getNanpureCellLineClassName({ row, column, lastRow, lastColumn }),
          getNanpureCellToneClassName({
            ...relation,
            value,
            clue,
            mistake,
            conflict,
          }),
          interactive && nanpureCellFocusClassName,
        );
        const content = (
          <>
            {value !== null ? (
              <span
                data-nanpure-digit={clue ? "clue" : "entered"}
                data-nanpure-mistake={mistake || undefined}
              >
                {value}
              </span>
            ) : (
              <NanpureCellNotes
                notes={cellNotes}
                selectedValue={selectedValue}
                size="figure"
              />
            )}
            {hintedCellIndex === cellIndex ? (
              <HowToPlayPressHint {...nanpurePressHintPlacement} />
            ) : null}
          </>
        );
        if (!interactive) {
          return (
            <span key={cellIndex} className={className}>
              {content}
            </span>
          );
        }
        return (
          <button
            key={cellIndex}
            type="button"
            aria-label={getNanpureCellAccessibleName({
              row: row - region.row + 1,
              column: column - region.column + 1,
              value,
              clue,
              notes: cellNotes,
              conflict,
              mistake,
            })}
            aria-pressed={relation.selected}
            aria-invalid={conflict || mistake || undefined}
            className={className}
            onClick={() => onSelectCell(cellIndex)}
          >
            {content}
          </button>
        );
      })}
    </span>
  );
}
