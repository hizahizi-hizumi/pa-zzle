import type { CSSProperties } from "react";

import { TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE } from "@/components/TutorialSpotlight";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import type { MinesweeperCellCue } from "@/games/minesweeper/ui/board/cell-cue";
import { MinesweeperCell } from "@/games/minesweeper/ui/board/MinesweeperCell";

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
};

function getCellKey(columns: number, cellIndex: number): string {
  const row = Math.floor(cellIndex / columns);
  const column = cellIndex % columns;
  return `${row}:${column}`;
}

/** 盤面と同じ格子にマスを重ねる部品（チュートリアルの始めの盤面へ戻す面）も、このクラスと `getMinesweeperBoardGridStyle` で並べる。 */
export const MINESWEEPER_BOARD_GRID_CLASS_NAME =
  "grid w-full gap-[4px] p-[8px]";

export function getMinesweeperBoardGridStyle(columns: number): CSSProperties {
  return { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
}

const BOARD_CLASS_NAME = `${MINESWEEPER_BOARD_GRID_CLASS_NAME} rounded-[6px] bg-[#a7b2c0] shadow-[0_2px_0_#8796a8,0_8px_16px_#52657b1f,inset_0_1px_0_#f7f9fc,inset_0_-1px_0_#909fb24d] dark:bg-[#2d3a4c] dark:shadow-[0_2px_0_#172333,0_8px_16px_#04091566,inset_0_1px_0_#7b8da34a,inset_0_-1px_0_#10192680]`;

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
    <div
      role="group"
      aria-label={`${MINESWEEPER_DISPLAY_NAME}盤面`}
      className={BOARD_CLASS_NAME}
      style={getMinesweeperBoardGridStyle(columns)}
      {...(spotlitCellIndices !== null && {
        [TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE]: "",
      })}
    >
      {cells.map(function renderCell(cell, cellIndex) {
        return (
          <MinesweeperCell
            key={getCellKey(columns, cellIndex)}
            cellIndex={cellIndex}
            view={cell}
            cue={cueByCellIndex.get(cellIndex)}
            spotlit={spotlitCellIndices?.includes(cellIndex) ?? false}
            disabled={interactionDisabled}
            onPress={handleCellPress}
            onFlagPress={handleCellFlagPress}
          />
        );
      })}
    </div>
  );
}
