import {
  buildGridPieces,
  createPiecePath,
} from "@/views/NotFoundView/MissingPageJigsaw/boardLayout";
import { Digit404 } from "@/views/NotFoundView/MissingPageJigsaw/Digit404";
import { LoosePuzzlePiece } from "@/views/NotFoundView/MissingPageJigsaw/LoosePuzzlePiece";

const cellSize = 52;
const gridColumns = 5;
const gridRows = 5;
const originX = 30;
const originY = 12;
const boardSize = cellSize * gridColumns;
const loosePieceSize = 80;
const loosePadding = 14;
const digitX = originX + 18;
const digitY = originY + 183;
const digitFontSize = 120;
const missingCells = [
  { row: 1, column: 2, startX: 92, startY: 304 },
  { row: 3, column: 2, startX: 168, startY: 304 },
] as const;

const boardPieces = buildGridPieces({
  cellSize,
  columns: gridColumns,
  rows: gridRows,
  originX,
  originY,
  missingCells,
});

const missingPieces = missingCells.map((cell) => ({
  ...cell,
  path: createPiecePath({
    row: cell.row,
    column: cell.column,
    rows: gridRows,
    columns: gridColumns,
    cellSize,
    originX,
    originY,
  }),
  pieceX: originX + cell.column * cellSize,
  pieceY: originY + cell.row * cellSize,
}));

export function Board404Typography() {
  return (
    <div className="relative h-96 w-80 select-none">
      <svg
        aria-hidden="true"
        viewBox="0 0 320 292"
        className="absolute inset-x-0 top-0 w-full overflow-visible"
      >
        <defs>
          {boardPieces.map((piece) => (
            <clipPath
              id={`board-piece-${piece.row}-${piece.column}`}
              key={`clip-${piece.row}-${piece.column}`}
            >
              <path d={piece.path} />
            </clipPath>
          ))}
        </defs>

        <rect
          x={originX}
          y={originY}
          width={boardSize}
          height={boardSize}
          className="fill-muted/15"
        />

        {boardPieces.map((piece) => (
          <g key={`piece-${piece.row}-${piece.column}`}>
            <path d={piece.path} className="fill-card" />
            <g clipPath={`url(#board-piece-${piece.row}-${piece.column})`}>
              <Digit404
                colorClassName="fill-muted-foreground/45"
                fontSize={digitFontSize}
                x={digitX}
                y={digitY}
              />
            </g>
            <path
              d={piece.path}
              fill="none"
              className="stroke-border"
              strokeWidth="1"
            />
          </g>
        ))}

        {missingPieces.map((piece) => (
          <path
            key={`hole-${piece.row}-${piece.column}`}
            d={piece.path}
            className="fill-background stroke-border"
            strokeWidth="1"
          />
        ))}
      </svg>

      {missingPieces.map((piece, index) => (
        <LoosePuzzlePiece
          key={`loose-${piece.row}-${piece.column}`}
          ariaName={`${index + 1}つ目の0のピースをドラッグして戻す`}
          placedAriaName={`${index + 1}つ目の0のピースがはまりました`}
          piecePath={piece.path}
          startX={piece.startX}
          startY={piece.startY}
          targetX={piece.pieceX - loosePadding}
          targetY={piece.pieceY - loosePadding}
          viewBox={`${piece.pieceX - loosePadding} ${piece.pieceY - loosePadding} ${loosePieceSize} ${loosePieceSize}`}
          width={loosePieceSize}
          height={loosePieceSize}
        >
          <Digit404
            colorClassName="fill-muted-foreground/45"
            fontSize={digitFontSize}
            x={digitX}
            y={digitY}
          />
        </LoosePuzzlePiece>
      ))}
    </div>
  );
}
