import {
  getReflectionCellPosition,
  type ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import { getReflectionBoardOrigin } from "@/games/reflection/ui/board/board-geometry";
import {
  REFLECTION_PIECE_HALO_WIDTH,
  REFLECTION_PIECE_STROKE_WIDTH,
  renderReflectionPieceShape,
} from "@/games/reflection/ui/board/ReflectionPieceIcon";

type ReflectionFigurePieceProps = {
  size: number;
  cellIndex: number;
  piece: ReflectionPiece;
};

/** ピースの形（100×100 の座標）をマスの80%に収める倍率。盤面の `cell` と同じ割合。 */
const PIECE_SCALE = 0.008;
const PIECE_INSET = 0.1;

/** 図のマスに、盤面と同じ形・線・縁取りでピースを描く。 */
export function ReflectionFigurePiece({
  size,
  cellIndex,
  piece,
}: ReflectionFigurePieceProps) {
  const { row, column } = getReflectionCellPosition(size, cellIndex);
  const origin = getReflectionBoardOrigin();
  const x = origin.x + column + PIECE_INSET;
  const y = origin.y + row + PIECE_INSET;

  return (
    <g
      transform={`translate(${x} ${y}) scale(${PIECE_SCALE})`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g
        className="fill-background stroke-background"
        strokeWidth={
          REFLECTION_PIECE_STROKE_WIDTH + REFLECTION_PIECE_HALO_WIDTH
        }
      >
        {renderReflectionPieceShape(piece, REFLECTION_PIECE_HALO_WIDTH)}
      </g>
      <g
        className="text-foreground"
        stroke="currentColor"
        strokeWidth={REFLECTION_PIECE_STROKE_WIDTH}
      >
        {renderReflectionPieceShape(piece)}
      </g>
    </g>
  );
}
