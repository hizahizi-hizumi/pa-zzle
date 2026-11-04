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
