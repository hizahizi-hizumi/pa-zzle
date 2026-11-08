import { useEffect, useRef } from "react";

import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import type { MinesweeperOperation } from "@/games/minesweeper/play/use-minesweeper-play";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import { MinesweeperCell } from "@/games/minesweeper/ui/board/MinesweeperCell";
import type { MinesweeperVisualStyle } from "@/games/minesweeper/ui/board/MinesweeperCellFace";
import { prefersReducedMotion } from "@/lib/motion";

export type MinesweeperInputMode = "reveal" | "flag";

export type MinesweeperBoardProps = {
  rows: number;
  columns: number;
  cells: readonly MinesweeperVisibleCell[];
  mode: MinesweeperInputMode;
  visualStyle?: MinesweeperVisualStyle;
  operation?: MinesweeperOperation | null;
  interactionDisabled: boolean;
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
};

function getCellKey(columns: number, cellIndex: number): string {
  const row = Math.floor(cellIndex / columns);
  const column = cellIndex % columns;
  return `${row}:${column}`;
}

const BOARD_CLASS_NAMES = {
  classic:
    "grid w-full border-l border-t border-slate-300 dark:border-slate-600",
  relief:
    "grid w-full gap-[3px] rounded-[11px] bg-[#82998a] p-[6px] shadow-[0_14px_32px_#45644c29,0_3px_8px_#45644c26,inset_0_1px_0_#dce9d7] dark:bg-[#162a23] dark:shadow-[0_14px_32px_#09100c55,inset_0_1px_0_#5d7767]",
  hybrid:
    "grid w-full gap-[4px] rounded-[13px] bg-[#a7b2c0] p-[8px] shadow-[0_2px_0_#8796a8,0_8px_16px_#52657b1f,inset_0_1px_0_#f7f9fc,inset_0_-1px_0_#909fb24d] dark:bg-[#2d3a4c] dark:shadow-[0_2px_0_#172333,0_8px_16px_#04091566,inset_0_1px_0_#7b8da34a,inset_0_-1px_0_#10192680]",
  ink: "grid w-full gap-px rounded-[7px] bg-[#a5b4b3] p-[3px] shadow-[0_8px_28px_#314f5c21] dark:bg-[#172f39] dark:shadow-[0_8px_28px_#07141b70]",
} satisfies Record<MinesweeperVisualStyle, string>;

/** 操作の発生源から開示が広がったように見せる。盤面の状態更新自体は遅らせない。 */
function useOpeningFeedback(
  cells: readonly MinesweeperVisibleCell[],
  columns: number,
  operation: MinesweeperOperation | null | undefined,
  visualStyle: MinesweeperVisualStyle,
) {
  const boardRef = useRef<HTMLDivElement>(null);
  const previousCellsRef = useRef(cells);
  const previousOperationIdRef = useRef<number | null>(null);

  useEffect(() => {
    const previousCells = previousCellsRef.current;
    previousCellsRef.current = cells;
    if (!operation || previousOperationIdRef.current === operation.id) {
      return;
    }
    previousOperationIdRef.current = operation.id;
    if (
      visualStyle === "classic" ||
      visualStyle === "hybrid" ||
      prefersReducedMotion()
    ) {
      return;
    }

    for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
      const cell = cells[cellIndex];
      const previous = previousCells[cellIndex];
      if (!cell || !previous || cell.state === previous.state) {
        continue;
      }
      const target = boardRef.current?.querySelector<HTMLElement>(
        `[data-cell-index="${cellIndex}"]`,
      );
      if (!target?.animate) {
        continue;
      }
      const distance =
        Math.abs(
          Math.floor(cellIndex / columns) -
            Math.floor(operation.cellIndex / columns),
        ) + Math.abs((cellIndex % columns) - (operation.cellIndex % columns));
      const isOpening = cell.state === "revealed";
      target.animate(
        isOpening
          ? [
              { opacity: 0.6, transform: "scale(0.94)" },
              { opacity: 1, transform: "scale(1)" },
            ]
          : [
              { transform: "scale(0.82)" },
              { transform: "scale(1.04)", offset: 0.65 },
              { transform: "scale(1)" },
            ],
        {
          duration: isOpening ? 165 : 205,
          delay: isOpening ? Math.min(distance, 6) * 18 : 0,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        },
      );
    }
  }, [cells, columns, operation, visualStyle]);

  return boardRef;
}

export function MinesweeperBoard({
  rows,
  columns,
  cells,
  mode,
  visualStyle = "classic",
  operation,
  interactionDisabled,
  onRevealCell,
  onToggleFlag,
  onChordCell,
}: MinesweeperBoardProps) {
  const boardRef = useOpeningFeedback(cells, columns, operation, visualStyle);

  if (cells.length !== rows * columns) {
    throw new Error(
      "Minesweeper visible cells must match the board dimensions",
    );
  }

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
      ref={boardRef}
      role="group"
      aria-label={`${MINESWEEPER_DISPLAY_NAME}盤面`}
      className={BOARD_CLASS_NAMES[visualStyle]}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cells.map(function renderCell(cell, cellIndex) {
        return (
          <MinesweeperCell
            key={getCellKey(columns, cellIndex)}
            cellIndex={cellIndex}
            view={cell}
            disabled={interactionDisabled}
            visualStyle={visualStyle}
            onPress={handleCellPress}
            onFlagPress={handleCellFlagPress}
          />
        );
      })}
    </div>
  );
}
