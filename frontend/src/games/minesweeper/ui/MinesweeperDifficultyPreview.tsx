import type { CSSProperties } from "react";

import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import {
  getMinesweeperCellCount,
  type MinesweeperBoard,
} from "@/games/minesweeper/puzzle/board";
import {
  getAdjacentMinesweeperMineCount,
  isMinesweeperMine,
} from "@/games/minesweeper/puzzle/rules";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import {
  getMinesweeperCellFaceClassName,
  MinesweeperCellFace,
} from "@/games/minesweeper/ui/board/MinesweeperCellFace";

// 3行の盤面の上段・下段に地雷を置き、中段の開示済みマスで隣接地雷数を見せる。
// "*"が地雷。上のレベルは下のレベルの地雷をすべて含み、列と地雷を増やして中段の数字を大きくする。
const previewMineLayouts = {
  "1": ["*...", "....", "...*"],
  "2": ["*....", ".....", ".*.*."],
  "3": ["*.*..*", "......", ".*.*.."],
  "4": ["*.*.**.", ".......", ".***..."],
  "5": ["***.**..", "........", ".***.*.."],
} satisfies Record<MinesweeperDifficulty, readonly string[]>;

// 最大8列でも枠線込みでプレビュー枠の幅128pxに収まるマスの大きさ。grid-cols / auto-rows の15pxと対応する。
// 全レベル共通で中段を開示し、考える余地として中段の最後の1マスだけ未開示に残す。
const REVEALED_ROW = 1;

function toPreviewBoard(layout: readonly string[]): MinesweeperBoard {
  const mineCellIndices = Array.from(layout.join("")).flatMap(
    function toMineCellIndex(mark, cellIndex) {
      return mark === "*" ? [cellIndex] : [];
    },
  );
  return {
    rows: layout.length,
    columns: layout[0]?.length ?? 0,
    mineCellIndices,
  };
}

function toPreviewCell(
  board: MinesweeperBoard,
  cellIndex: number,
): MinesweeperVisibleCell {
  if (isMinesweeperMine(board, cellIndex)) {
    return { state: "mine" };
  }
  const row = Math.floor(cellIndex / board.columns);
  const column = cellIndex % board.columns;
  if (row !== REVEALED_ROW || column === board.columns - 1) {
    return { state: "hidden" };
  }
  return {
    state: "revealed",
    adjacentMineCount: getAdjacentMinesweeperMineCount(board, cellIndex),
  };
}

function createPreviewCells(
  difficulty: MinesweeperDifficulty,
): MinesweeperVisibleCell[] {
  const board = toPreviewBoard(previewMineLayouts[difficulty]);
  return Array.from(
    { length: getMinesweeperCellCount(board) },
    function toCell(_, cellIndex) {
      return toPreviewCell(board, cellIndex);
    },
  );
}

type MinesweeperDifficultyPreviewProps = {
  difficulty: MinesweeperDifficulty;
};

export function MinesweeperDifficultyPreview({
  difficulty,
}: MinesweeperDifficultyPreviewProps) {
  const columns = previewMineLayouts[difficulty][0]?.length ?? 0;
  const cells = createPreviewCells(difficulty);

  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-32 shrink-0 items-center lg:justify-center"
    >
      <span
        className="grid auto-rows-[15px] grid-cols-[repeat(var(--preview-columns),15px)] border-t border-l border-slate-300 dark:border-slate-600"
        style={{ "--preview-columns": columns } as CSSProperties}
      >
        {cells.map(function renderCell(cell, cellIndex) {
          const row = Math.floor(cellIndex / columns);
          const column = cellIndex % columns;
          return (
            <span
              key={`${row}-${column}`}
              className={getMinesweeperCellFaceClassName(cell, "preview")}
            >
              <MinesweeperCellFace view={cell} size="preview" />
            </span>
          );
        })}
      </span>
    </span>
  );
}

export const _private = { previewMineLayouts, createPreviewCells };
