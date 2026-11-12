import type { CSSProperties } from "react";

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
  /** マスに一時的に重ねる合図。通常のプレイでは渡さない。 */
  cues?: readonly MinesweeperCellCue[];
  /** チュートリアルで手を引いている間、画面全体の覆いから抜いて元の明るさで見せるマス。次に操作するマスと、それを決めるマス。通常のプレイでは渡さない。 */
  spotlitCellIndices?: readonly number[];
  /** 盤面を変えない操作を受けた。開いたマス・地雷のマスを、その操作で変えられないのに押した。チュートリアルで印へ目を向けさせるのに使い、通常のプレイでは渡さない。 */
  onIneffectiveCellPress?: (cellIndex: number) => void;
};

function getCellKey(columns: number, cellIndex: number): string {
  const row = Math.floor(cellIndex / columns);
  const column = cellIndex % columns;
  return `${row}:${column}`;
}

/** マスの並べ方。盤面と同じ格子にマスを重ねる部品（チュートリアルの始めの盤面へ戻す面）も、このクラスと `getMinesweeperBoardGridStyle` で並べる。 */
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
  spotlitCellIndices = [],
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
    // data-play-entry-board: ゲームのホームから入るとき、広がった盤面が重なって着地する先。
    <div
      data-play-entry-board=""
      role="group"
      aria-label={`${MINESWEEPER_DISPLAY_NAME}盤面`}
      className={BOARD_CLASS_NAME}
      style={getMinesweeperBoardGridStyle(columns)}
    >
      {cells.map(function renderCell(cell, cellIndex) {
        return (
          <MinesweeperCell
            key={getCellKey(columns, cellIndex)}
            cellIndex={cellIndex}
            view={cell}
            cue={cueByCellIndex.get(cellIndex)}
            spotlit={spotlitCellIndices.includes(cellIndex)}
            disabled={interactionDisabled}
            onPress={handleCellPress}
            onFlagPress={handleCellFlagPress}
          />
        );
      })}
    </div>
  );
}
