import type { ReactNode } from "react";

import { listMagicSquareLineEvaluations } from "@/games/magic-square/puzzle/rules";
import type { MagicSquareSession } from "@/games/magic-square/session/session";
import {
  getMagicSquareFrameUnits,
  type MagicSquareBoardRegion,
} from "@/games/magic-square/ui/board/board-layout";
import {
  MagicSquareBoard,
  type MagicSquareCellRejection,
} from "@/games/magic-square/ui/board/MagicSquareBoard";

/**
 * 例のマスの大きさの上限（px）。1行だけの例も盤面の全体の例も同じ大きさにし、ゴールの盤面のマスと見比べて同じ物に見える大きさにする。
 * 狭い画面では、盤面の幅が面の内側の幅に収まる大きさにする。数の欄も同じ幅に並べる。
 */
export const MAGIC_SQUARE_EXAMPLE_CELL_MAX_PX = 52;

/** 例の盤面と数の欄の幅。盤面の幅は、範囲の列と帯の幅をマスの数で表したものに、マスの大きさを掛けた幅。 */
export function getMagicSquareExampleWidth(columns: number): string {
  return `min(100cqw, ${MAGIC_SQUARE_EXAMPLE_CELL_MAX_PX * columns}px)`;
}

type ExampleBoardProps = {
  session: MagicSquareSession;
  region: MagicSquareBoardRegion;
  selectedCellIndex: number | null;
  /** 盤面の幅。渡さなければ例の幅（`getMagicSquareExampleWidth`）にする。 */
  width?: string;
  /** 押せない図では渡さない。 */
  onSelectCell?: (cellIndex: number) => void;
  rejection?: MagicSquareCellRejection | null;
  renderCellOverlay?: (cellIndex: number) => ReactNode;
};

function ignore(): void {}

/** 例の盤面。本番の盤面部品で、範囲のマスと行の合計を描く。 */
export function ExampleBoard({
  session,
  region,
  selectedCellIndex,
  width,
  onSelectCell,
  rejection = null,
  renderCellOverlay,
}: ExampleBoardProps) {
  const { puzzleState, problem } = session;
  const units = getMagicSquareFrameUnits(puzzleState.size, region);
  return (
    <div
      style={{
        width: width ?? getMagicSquareExampleWidth(units.columns),
        aspectRatio: `${units.columns} / ${units.rows}`,
      }}
    >
      <MagicSquareBoard
        givens={problem.givens}
        board={puzzleState}
        memos={puzzleState.memos}
        lineEvaluations={listMagicSquareLineEvaluations(puzzleState)}
        selectedCellIndex={selectedCellIndex}
        interactionDisabled={onSelectCell === undefined}
        clearing={false}
        region={region}
        rejection={rejection}
        renderCellOverlay={renderCellOverlay}
        onSelectCell={onSelectCell ?? ignore}
        onClearAnimationComplete={ignore}
      />
    </div>
  );
}
