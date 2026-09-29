import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import {
  getReflectionCellPosition,
  type ReflectionBoard as ReflectionBoardState,
} from "@/games/reflection/puzzle/board";
import {
  listReflectionEntries,
  type ReflectionClue,
} from "@/games/reflection/puzzle/laser";
import type { ReflectionSelection } from "@/games/reflection/session/session";
import { ReflectionCell } from "@/games/reflection/ui/board/ReflectionBoard/ReflectionCell";
import { ReflectionClueLabel } from "@/games/reflection/ui/board/ReflectionBoard/ReflectionClueLabel";

type ReflectionBoardProps = {
  board: ReflectionBoardState;
  clues: readonly ReflectionClue[];
  selection: ReflectionSelection | null;
  disabled: boolean;
  onTapCell: (cellIndex: number) => void;
};

/** 盤面と、その四辺を囲む外周ヒント。 */
export function ReflectionBoard({
  board,
  clues,
  selection,
  disabled,
  onTapCell,
}: ReflectionBoardProps) {
  const { size } = board;
  const entries = listReflectionEntries(size);
  const selectedCellIndex =
    selection?.type === "cell" ? selection.cellIndex : null;

  return (
    <div
      className="grid aspect-square w-full max-w-[30rem]"
      style={{
        gridTemplateColumns: `repeat(${size + 2}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size + 2}, minmax(0, 1fr))`,
      }}
    >
      {entries.map(function renderClue(entry, clueIndex) {
        const clue = clues[clueIndex];
        return clue ? (
          <ReflectionClueLabel
            key={`${entry.side}:${entry.index}`}
            size={size}
            entry={entry}
            clue={clue}
          />
        ) : null;
      })}
      <div
        role="group"
        aria-label={`${REFLECTION_DISPLAY_NAME}盤面`}
        className="grid border-2 border-foreground/55 bg-background"
        style={{
          gridRow: `2 / span ${size}`,
          gridColumn: `2 / span ${size}`,
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        {board.cells.map(function renderCell(cell, cellIndex) {
          const { row, column } = getReflectionCellPosition(size, cellIndex);
          return (
            <ReflectionCell
              key={`${row}:${column}`}
              size={size}
              cellIndex={cellIndex}
              cell={cell}
              selected={selectedCellIndex === cellIndex}
              disabled={disabled}
              onTap={onTapCell}
            />
          );
        })}
      </div>
    </div>
  );
}
