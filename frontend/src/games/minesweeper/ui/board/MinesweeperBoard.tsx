import type { ReactNode } from "react";

import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import type { MinesweeperCellCue } from "@/games/minesweeper/ui/board/cell-cue";
import { MinesweeperCell } from "@/games/minesweeper/ui/board/MinesweeperBoard/MinesweeperCell";
import { MinesweeperBoardGrid } from "@/games/minesweeper/ui/board/MinesweeperBoardGrid";

export type MinesweeperInputMode = "reveal" | "flag";

export type MinesweeperBoardProps = {
  rows: number;
  columns: number;
  cells: readonly MinesweeperVisibleCell[];
  mode: MinesweeperInputMode;
  interactionDisabled: boolean;
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
  cues?: readonly MinesweeperCellCue[];
  /** `null` でない間だけ、盤面を覆う範囲にする。 */
  spotlitCellIndices?: readonly number[] | null;
  onIneffectiveCellPress?: (cellIndex: number) => void;
  /** 遊び方の例が、マスの面の上に重ねる見せ方を返す。渡さなければ本番と同じに描く。 */
  renderCellOverlay?: (cellIndex: number) => ReactNode;
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
  onRevealCell,
  onToggleFlag,
  onChordCell,
  cues = [],
  spotlitCellIndices = null,
  onIneffectiveCellPress,
  renderCellOverlay,
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
      } else {
        onIneffectiveCellPress?.(cellIndex);
      }
      return;
    }

    if (cell.state === "mine" || cell.state === "steppedMine") {
      onIneffectiveCellPress?.(cellIndex);
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
    } else {
      onIneffectiveCellPress?.(cellIndex);
    }
  }

  return (
    <MinesweeperBoardGrid
      columns={columns}
      role="group"
      aria-label={`${MINESWEEPER_DISPLAY_NAME}盤面`}
      spotlightArea={spotlitCellIndices !== null}
    >
      {cells.map(function renderCell(cell, cellIndex) {
        return (
          <MinesweeperCell
            key={getCellKey(columns, cellIndex)}
            cellIndex={cellIndex}
            view={cell}
            cue={cueByCellIndex.get(cellIndex)}
            spotlit={spotlitCellIndices?.includes(cellIndex) ?? false}
            overlay={renderCellOverlay?.(cellIndex)}
            disabled={interactionDisabled}
            onPress={handleCellPress}
            onFlagPress={handleCellFlagPress}
          />
        );
      })}
    </MinesweeperBoardGrid>
  );
}
