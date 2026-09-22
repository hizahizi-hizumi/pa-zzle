import { Button } from "@/components/ui/button";
import { Link } from "@/router";
import {
  buildGridPieces,
  createPiecePath,
} from "@/views/NotFoundView/MissingPageJigsaw/boardLayout";
import { Digit404 } from "@/views/NotFoundView/MissingPageJigsaw/Digit404";
import { LoosePuzzlePiece } from "@/views/NotFoundView/MissingPageJigsaw/LoosePuzzlePiece";

const cellSize = 44;
const gridColumns = 6;
const gridRows = 7;
const originX = 28;
const originY = 12;
const boardWidth = cellSize * gridColumns;
const boardHeight = cellSize * gridRows;
const loosePieceSize = 70;
const loosePadding = 13;
const digitX = originX + 28;
const digitY = originY + 115;
const digitFontSize = 86;
const missingCells = [
  { row: 1, column: 2, startX: 92, startY: 370 },
  { row: 1, column: 3, startX: 162, startY: 370 },
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

export function WholePageJigsaw404() {
  return (
    <section className="mx-auto flex max-w-xl justify-center py-8 sm:py-12">
      <div className="relative h-[28.5rem] w-80 select-none">
        <svg
          aria-hidden="true"
          viewBox="0 0 320 352"
          className="absolute inset-x-0 top-0 w-full overflow-visible"
        >
          <defs>
            {boardPieces.map((piece) => (
              <clipPath
                id={`page-piece-${piece.row}-${piece.column}`}
                key={`clip-${piece.row}-${piece.column}`}
              >
                <path d={piece.path} />
              </clipPath>
            ))}
          </defs>

          <rect
            x={originX}
            y={originY}
            width={boardWidth}
            height={boardHeight}
            rx="16"
            className="fill-muted/10"
          />

          {boardPieces.map((piece) => (
            <g key={`piece-${piece.row}-${piece.column}`}>
              <path d={piece.path} className="fill-card" />
              <g clipPath={`url(#page-piece-${piece.row}-${piece.column})`}>
                <Digit404
                  colorClassName="fill-muted-foreground/40"
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

        <div className="absolute inset-x-0 top-40 flex flex-col items-center gap-6 px-8 text-center">
          <h1 className="text-screen-title">ページが見つかりません</h1>
          <Button asChild size="lg">
            <Link to="/">パズル一覧へ戻る</Link>
          </Button>
        </div>

        {missingPieces.map((piece, index) => (
          <LoosePuzzlePiece
            key={`loose-${piece.row}-${piece.column}`}
            ariaName={`ページ版の${index + 1}つ目の0のピースをドラッグして戻す`}
            placedAriaName={`ページ版の${index + 1}つ目の0のピースがはまりました`}
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
              colorClassName="fill-muted-foreground/40"
              fontSize={digitFontSize}
              x={digitX}
              y={digitY}
            />
          </LoosePuzzlePiece>
        ))}
      </div>
    </section>
  );
}
