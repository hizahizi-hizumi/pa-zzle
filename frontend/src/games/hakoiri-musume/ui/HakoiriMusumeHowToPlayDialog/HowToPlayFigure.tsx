import { Pointer } from "lucide-react";

import {
  getHakoiriMusumeCellPosition,
  type HakoiriMusumePiece,
  hakoiriMusumePieceShapes,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  BOX_HEIGHT_CELLS,
  BOX_RIM_CELLS,
  BOX_WIDTH_CELLS,
  getPieceRect,
  toBoxStyle,
} from "@/games/hakoiri-musume/ui/board/board-geometry";
import { HakoiriMusumeBox } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBox";
import { HakoiriMusumePieceFace } from "@/games/hakoiri-musume/ui/board/HakoiriMusumePieceFace";
import { hakoiriMusumeToneClassNames } from "@/games/hakoiri-musume/ui/hakoiri-musume-tone";

/** 図の中でなぞる指の道。`pieceIndex` 番目の駒の左上が `cells` の順に通るように、駒の真ん中をなぞる。 */
export type HowToPlayTrace = {
  pieceIndex: number;
  cells: readonly number[];
};

type HowToPlayFigureProps = {
  pieces: readonly HakoiriMusumePiece[];
  /** なぞる指の道。なぞる前の図に添え、終わりに指を置く。 */
  trace?: HowToPlayTrace;
};

/** 駒の左上を `cell` に置いたときの駒の真ん中。箱の外形の左上を原点に、マス幅を 1 とした座標。 */
function getPieceCenter(piece: HakoiriMusumePiece, cell: number) {
  const { row, column } = getHakoiriMusumeCellPosition(cell);
  const shape = hakoiriMusumePieceShapes[piece.kind];
  return {
    x: BOX_RIM_CELLS + column + shape.columns / 2,
    y: BOX_RIM_CELLS + row + shape.rows / 2,
  };
}

/** 遊び方の小さな盤面。プレイ中の箱と駒と同じ姿で、押せない。 */
export function HowToPlayFigure({ pieces, trace }: HowToPlayFigureProps) {
  const tracePoints = trace
    ? trace.cells.map((cell) => getPieceCenter(pieces[trace.pieceIndex]!, cell))
    : [];
  const finger = tracePoints.at(-1);

  return (
    <div className="relative min-w-0 max-w-24 flex-1" aria-hidden>
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
      {finger ? (
        <>
          <svg
            className="absolute inset-0 size-full"
            viewBox={`0 0 ${BOX_WIDTH_CELLS} ${BOX_HEIGHT_CELLS}`}
          >
            <polyline
              className={hakoiriMusumeToneClassNames.howToPlayTrace}
              points={tracePoints.map(({ x, y }) => `${x},${y}`).join(" ")}
              fill="none"
              strokeWidth={0.14}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <Pointer
            className="absolute size-5 fill-background text-foreground"
            style={{
              left: `${(finger.x / BOX_WIDTH_CELLS) * 100}%`,
              top: `${(finger.y / BOX_HEIGHT_CELLS) * 100}%`,
            }}
          />
        </>
      ) : null}
    </div>
  );
}
