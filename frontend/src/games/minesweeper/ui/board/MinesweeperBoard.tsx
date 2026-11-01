import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import type { MinesweeperCellCue } from "@/games/minesweeper/ui/board/cell-cue";
import { MinesweeperCell } from "@/games/minesweeper/ui/board/MinesweeperCell";

export type MinesweeperInputMode = "reveal" | "flag";

type MinesweeperBoardProps = {
  rows: number;
  columns: number;
  cells: readonly MinesweeperVisibleCell[];
  mode: MinesweeperInputMode;
  interactionDisabled: boolean;
  /** チュートリアルで重ねる合図。 */
  cues?: readonly MinesweeperCellCue[];
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
};

function getCellKey(columns: number, cellIndex: number): string {
  const row = Math.floor(cellIndex / columns);
  const column = cellIndex % columns;
  return `${row}:${column}`;
}

export function MinesweeperBoard({
  rows,
  columns,
  cells,
  mode,
  interactionDisabled,
  cues = [],
  onRevealCell,
  onToggleFlag,
  onChordCell,
}: MinesweeperBoardProps) {
  if (cells.length !== rows * columns) {
    throw new Error(
      "Minesweeper visible cells must match the board dimensions",
    );
  }

  const cueByCellIndex = new Map(cues.map((cue) => [cue.cellIndex, cue]));

  function handleCellPress(cellIndex: number): void {
    const cell = cells[cellIndex];
    if (!cell) {
      return;
    }

    if (cell.state === "revealed") {
      if (mode === "reveal") {
        onChordCell(cellIndex);
      }
      return;
    }

    if (cell.state === "mine" || cell.state === "steppedMine") {
      return;
    }

    if (mode === "flag") {
      onToggleFlag(cellIndex);
      return;
    }

    onRevealCell(cellIndex);
  }

  function handleCellFlagPress(cellIndex: number): void {
    const cell = cells[cellIndex];
    if (cell?.state === "hidden" || cell?.state === "flagged") {
      onToggleFlag(cellIndex);
    }
  }

  return (
    <div
      role="group"
      aria-label={`${MINESWEEPER_DISPLAY_NAME}盤面`}
      className="grid w-full border-l border-t border-slate-300 dark:border-slate-600"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cells.map(function renderCell(cell, cellIndex) {
        return (
          <MinesweeperCell
            key={getCellKey(columns, cellIndex)}
            cellIndex={cellIndex}
            waveStep={Math.floor(cellIndex / columns) + (cellIndex % columns)}
            view={cell}
            cue={cueByCellIndex.get(cellIndex)}
            disabled={interactionDisabled}
            onPress={handleCellPress}
            onFlagPress={handleCellFlagPress}
          />
        );
      })}
    </div>
  );
}
