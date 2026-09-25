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

const BOARD_SIZE = 5;

// 5×5盤面の外周に地雷を置き、内側の開示済みマスで隣接地雷数を見せる。
// "*"が地雷。上の難易度は下の難易度の地雷をすべて含む。
const mineLayouts = {
  "1": "..*......*.....*.........",
  "2": "..*..*...*.....*.....*...",
  "3": ".**..*...*.....*...*.*...",
  "4": ".**..*...**....*...*.*.*.",
  "5": ".***.*...**....*...***.*.",
} satisfies Record<MinesweeperDifficulty, string>;

// 全難易度で共通の開示範囲。"o"が開示済み、それ以外は未開示。
const revealedArea = [".....", ".ooo.", ".ooo.", ".oo..", "....."].join("");

function toPreviewBoard(layout: string): MinesweeperBoard {
  const mineCellIndices = Array.from(layout).flatMap(
    function toMineCellIndex(mark, cellIndex) {
      return mark === "*" ? [cellIndex] : [];
    },
  );
  return { rows: BOARD_SIZE, columns: BOARD_SIZE, mineCellIndices };
}

function toPreviewCell(
  board: MinesweeperBoard,
  cellIndex: number,
): MinesweeperVisibleCell {
  if (isMinesweeperMine(board, cellIndex)) {
    return { state: "mine" };
  }
  if (revealedArea[cellIndex] !== "o") {
    return { state: "hidden" };
  }
  return {
    state: "revealed",
    adjacentMineCount: getAdjacentMinesweeperMineCount(board, cellIndex),
  };
}

function getCellKey(cellIndex: number): string {
  const row = Math.floor(cellIndex / BOARD_SIZE);
  const column = cellIndex % BOARD_SIZE;
  return `${row}-${column}`;
}

type MinesweeperDifficultyPreviewProps = {
  difficulty: MinesweeperDifficulty;
};

export function MinesweeperDifficultyPreview({
  difficulty,
}: MinesweeperDifficultyPreviewProps) {
  const board = toPreviewBoard(mineLayouts[difficulty]);
  const cells = Array.from(
    { length: getMinesweeperCellCount(board) },
    function toCell(_, cellIndex) {
      return toPreviewCell(board, cellIndex);
    },
  );

  return (
    <span
      aria-hidden="true"
      className="grid size-[81px] shrink-0 grid-cols-5 border-t border-l border-slate-300 lg:size-[106px] dark:border-slate-600"
    >
      {cells.map(function renderCell(cell, cellIndex) {
        return (
          <span
            key={getCellKey(cellIndex)}
            className={getMinesweeperCellFaceClassName(cell, "preview")}
          >
            <MinesweeperCellFace view={cell} size="preview" />
          </span>
        );
      })}
    </span>
  );
}
