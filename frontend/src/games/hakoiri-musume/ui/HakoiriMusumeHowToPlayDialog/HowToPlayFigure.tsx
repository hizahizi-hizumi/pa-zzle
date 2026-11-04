import {
  getHakoiriMusumeCellPosition,
  type HakoiriMusumePiece,
  hakoiriMusumePieceShapes,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  getPieceRect,
  toBoxStyle,
} from "@/games/hakoiri-musume/ui/board/board-geometry";
import { HakoiriMusumeBox } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBox";
import { HakoiriMusumePieceFace } from "@/games/hakoiri-musume/ui/board/HakoiriMusumePieceFace";

type HowToPlayFigureProps = {
  pieces: readonly HakoiriMusumePiece[];
};

/** 遊び方の小さな盤面。プレイ中の箱と駒と同じ姿で、押せない。 */
export function HowToPlayFigure({ pieces }: HowToPlayFigureProps) {
  return (
    <div className="w-24 shrink-0" aria-hidden>
      <HakoiriMusumeBox>
        {pieces.map((piece) => (
          <span
            key={piece.cell}
            className="absolute"
            style={toBoxStyle(
              getPieceRect(
                getHakoiriMusumeCellPosition(piece.cell),
                hakoiriMusumePieceShapes[piece.kind],
              ),
            )}
          >
            <HakoiriMusumePieceFace kind={piece.kind} />
          </span>
        ))}
      </HakoiriMusumeBox>
    </div>
  );
}
