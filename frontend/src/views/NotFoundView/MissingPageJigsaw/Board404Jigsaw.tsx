import {
  BOARD_CELL_SIZE,
  BOARD_GRID_SIZE,
  BOARD_SIZE,
  BOARD_X,
  BOARD_Y,
  FOUR_GLYPH_PATH,
  glyphTransform,
  ZERO_GLYPH_PATH,
} from "@/views/NotFoundView/MissingPageJigsaw/board404Art";
import {
  complementaryEdge,
  createJigsawPiecePath,
  type JigsawEdge,
  type JigsawEdges,
} from "@/views/NotFoundView/MissingPageJigsaw/jigsawGeometry";
import { LooseBoardPiece } from "@/views/NotFoundView/MissingPageJigsaw/LooseBoardPiece";

const horizontalSeams: JigsawEdge[][] = [
  ["tab", "blank", "tab", "blank"],
  ["blank", "tab", "tab", "blank"],
  ["tab", "tab", "blank", "tab"],
  ["blank", "tab", "blank", "blank"],
  ["tab", "blank", "blank", "tab"],
];
const verticalSeams: JigsawEdge[][] = [
  ["blank", "tab", "blank", "tab", "blank"],
  ["tab", "blank", "tab", "blank", "tab"],
  ["blank", "blank", "tab", "tab", "blank"],
  ["tab", "blank", "blank", "tab", "tab"],
];

const missingCells = [
  { row: 1, column: 2, startX: 92, startY: 304 },
  { row: 3, column: 2, startX: 168, startY: 304 },
] as const;
const missingKeys = new Set(missingCells.map(cellKey));

type BoardPiece = {
  column: number;
  path: string;
  row: number;
};

const boardPieces = createBoardPieces();
const missingPieces = missingCells.map(createMissingPiece);

function cellKey(cell: { row: number; column: number }) {
  return `${cell.row}-${cell.column}`;
}

function createBoardPieces() {
  const pieces: BoardPiece[] = [];

  for (let row = 0; row < BOARD_GRID_SIZE; row += 1) {
    for (let column = 0; column < BOARD_GRID_SIZE; column += 1) {
      if (missingKeys.has(cellKey({ row, column }))) continue;

      pieces.push({
        column,
        path: createPiecePath(row, column),
        row,
      });
    }
  }

  return pieces;
}

function createMissingPiece(cell: (typeof missingCells)[number]) {
  return {
    ...cell,
    path: createPiecePath(cell.row, cell.column),
    pieceX: BOARD_X + cell.column * BOARD_CELL_SIZE,
    pieceY: BOARD_Y + cell.row * BOARD_CELL_SIZE,
  };
}

function createPiecePath(row: number, column: number) {
  const edges: JigsawEdges = {
    top:
      row === 0
        ? "flat"
        : complementaryEdge(verticalSeams[row - 1]?.[column] ?? "flat"),
    right:
      column === BOARD_GRID_SIZE - 1
        ? "flat"
        : (horizontalSeams[row]?.[column] ?? "flat"),
    bottom:
      row === BOARD_GRID_SIZE - 1
        ? "flat"
        : (verticalSeams[row]?.[column] ?? "flat"),
    left:
      column === 0
        ? "flat"
        : complementaryEdge(horizontalSeams[row]?.[column - 1] ?? "flat"),
  };

  return createJigsawPiecePath(
    BOARD_X + column * BOARD_CELL_SIZE,
    BOARD_Y + row * BOARD_CELL_SIZE,
    BOARD_CELL_SIZE,
    edges,
  );
}

export function Board404Jigsaw() {
  return (
    <div className="relative h-96 w-80 select-none">
      <svg
        aria-hidden="true"
        viewBox="0 0 320 292"
        className="absolute inset-x-0 top-0 w-full overflow-visible"
      >
        <defs>
          {boardPieces.map(function renderClip(piece) {
            return (
              <clipPath
                id={`board-404-piece-${piece.row}-${piece.column}`}
                key={`clip-${piece.row}-${piece.column}`}
              >
                <path d={piece.path} />
              </clipPath>
            );
          })}
        </defs>

        <rect
          x={BOARD_X}
          y={BOARD_Y}
          width={BOARD_SIZE}
          height={BOARD_SIZE}
          className="fill-muted/20"
        />

        {boardPieces.map(function renderPiece(piece) {
          const clipId = `board-404-piece-${piece.row}-${piece.column}`;
          return (
            <g key={`piece-${piece.row}-${piece.column}`}>
              <path d={piece.path} className="fill-card" />
              <g
                clipPath={`url(#${clipId})`}
                className="fill-muted-foreground opacity-45"
              >
                <path d={FOUR_GLYPH_PATH} transform={glyphTransform(0)} />
                <path d={ZERO_GLYPH_PATH} transform={glyphTransform(1)} />
                <path d={FOUR_GLYPH_PATH} transform={glyphTransform(2)} />
              </g>
              <path
                d={piece.path}
                fill="none"
                className="stroke-border"
                strokeWidth="1"
              />
            </g>
          );
        })}

        {missingPieces.map(function renderHole(piece) {
          return (
            <path
              key={`hole-${piece.row}-${piece.column}`}
              d={piece.path}
              className="fill-background stroke-border"
              strokeWidth="1"
            />
          );
        })}
      </svg>

      {missingPieces.map(function renderLoosePiece(piece, index) {
        return (
          <LooseBoardPiece
            key={`loose-${piece.row}-${piece.column}`}
            accessibleName={`${index + 1}つ目の0のピースをドラッグして戻す`}
            placedName={`${index + 1}つ目の0のピースがはまりました`}
            piecePath={piece.path}
            pieceX={piece.pieceX}
            pieceY={piece.pieceY}
            startX={piece.startX}
            startY={piece.startY}
          />
        );
      })}
    </div>
  );
}
