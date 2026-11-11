import type { CSSProperties } from "react";

import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { getMinesweeperVisibleCells } from "@/games/minesweeper/session/session";
import { MinesweeperBoard } from "@/games/minesweeper/ui/board/MinesweeperBoard";

type MinesweeperProblemPreviewProps = {
  problem: MinesweeperProblem;
};

/**
 * プレイ画面での盤面の幅（画面の幅から左右の余白を除き、32rem まで）。
 * マスの隙間・角丸・数字の大きさは px と vw で決まっていて盤の幅に連れて縮まないので、この幅で並べてから全体を縮め、
 * 小さな枠でもプレイ画面と同じ釣り合いに見せる。
 */
const PREVIEW_LAYOUT_WIDTH = "min(100vw - 1rem, 32rem)";
/** 盤面の内側の余白（`p-[8px]` の両側）と、マスの隙間（`gap-[4px]`）。 */
const BOARD_PADDING_PX = 16;
const CELL_GAP_PX = 4;

function getPreviewLayoutStyle(rows: number, columns: number): CSSProperties {
  const cellSize = `(${PREVIEW_LAYOUT_WIDTH} - ${BOARD_PADDING_PX + CELL_GAP_PX * (columns - 1)}px) / ${columns}`;
  const height = `calc(${cellSize} * ${rows} + ${BOARD_PADDING_PX + CELL_GAP_PX * (rows - 1)}px)`;
  const width = `calc(${PREVIEW_LAYOUT_WIDTH})`;
  return {
    width,
    height,
    // tan(atan2(a, b)) は長さどうしの比 a / b を数として求める。置かれた枠（`container-type: size`）に収まる倍率にする。
    scale: `min(tan(atan2(100cqw, ${width})), tan(atan2(100cqh, ${height})))`,
  };
}

function ignoreCellOperation() {}

/** 1問の、始めたときの盤面。開始マスから開いたマスを含め、プレイ画面と同じ盤面を、置かれた枠に収まる大きさで中央に描く。操作は受けない。 */
export function MinesweeperProblemPreview({
  problem,
}: MinesweeperProblemPreviewProps) {
  const { board, initialRevealedCellIndices } = problem;
  const cells = getMinesweeperVisibleCells(
    board,
    {
      revealedCellIndices: initialRevealedCellIndices,
      flaggedCellIndices: [],
      steppedMineCellIndices: [],
    },
    false,
  );
  return (
    <div
      className="shrink-0"
      style={getPreviewLayoutStyle(board.rows, board.columns)}
    >
      <MinesweeperBoard
        rows={board.rows}
        columns={board.columns}
        cells={cells}
        mode="reveal"
        interactionDisabled
        onRevealCell={ignoreCellOperation}
        onToggleFlag={ignoreCellOperation}
        onChordCell={ignoreCellOperation}
      />
    </div>
  );
}
