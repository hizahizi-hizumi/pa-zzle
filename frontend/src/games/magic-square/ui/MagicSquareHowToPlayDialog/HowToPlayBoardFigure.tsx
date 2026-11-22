import { listMagicSquareLineEvaluations } from "@/games/magic-square/puzzle/rules";
import { getMagicSquareFrameUnits } from "@/games/magic-square/ui/board/board-layout";
import { MagicSquareBoard } from "@/games/magic-square/ui/board/MagicSquareBoard";
import type { MagicSquareFigureBoard } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";

/**
 * - `goal`: 入口のゴールの盤面。置き場所の幅と、遊び方の層が渡す盤面の大きさの上限の小さい方に収める。
 * - `example`: ルールと操作の例。面の内側の幅に収まり、マスを 44px までにする。
 */
export type HowToPlayBoardFigureSize = "goal" | "example";

type HowToPlayBoardFigureProps = {
  figure: MagicSquareFigureBoard;
  size: HowToPlayBoardFigureSize;
};

const EXAMPLE_CELL_MAX_PX = 44;

function ignore(): void {}

function getFigureWidth(size: HowToPlayBoardFigureSize, columns: number) {
  return size === "goal"
    ? "min(100cqw, var(--how-to-play-goal-board-max, 100cqw), 100cqh - var(--how-to-play-goal-below, 0px))"
    : `min(100cqw, ${EXAMPLE_CELL_MAX_PX * columns}px)`;
}

/** 本番の盤面部品を、押せない図として描く。 */
export function HowToPlayBoardFigure({
  figure,
  size,
}: HowToPlayBoardFigureProps) {
  const { givens, board, selectedCellIndex } = figure;
  const units = getMagicSquareFrameUnits(board.size);

  return (
    <div
      inert
      style={{
        width: getFigureWidth(size, units.columns),
        aspectRatio: `${units.columns} / ${units.rows}`,
      }}
    >
      <MagicSquareBoard
        givens={givens}
        board={board}
        lineEvaluations={listMagicSquareLineEvaluations(board)}
        selectedCellIndex={selectedCellIndex}
        interactionDisabled
        clearing={false}
        onSelectCell={ignore}
        onClearAnimationComplete={ignore}
      />
    </div>
  );
}
