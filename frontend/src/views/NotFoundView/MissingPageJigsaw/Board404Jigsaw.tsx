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
  { row: 1, column: 2, startX: 88, startY: 304 },
  { row: 3, column: 2, startX: 166, startY: 304 },
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
          <filter
            id="board-404-shadow"
            x="-20%"
            y="-20%"
            width="140%"
            height="160%"
          >
            <feDropShadow
              dx="0"
              dy="7"
              stdDeviation="7"
              floodColor="rgb(15 23 42 / 0.14)"
            />
          </filter>
          <filter
            id="board-404-paper"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="2"
              seed="29"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.52 0 0 0 0.055 0"
              result="grain-color"
            />
            <feComposite
              in="grain-color"
              in2="SourceAlpha"
              operator="in"
              result="grain"
            />
            <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
          </filter>
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

        <g filter="url(#board-404-shadow)">
          <rect
            x={BOARD_X}
            y={BOARD_Y + 4}
            width={BOARD_SIZE}
            height={BOARD_SIZE}
            className="fill-muted-foreground opacity-30"
          />

          {boardPieces.map(function renderPiece(piece) {
            const clipId = `board-404-piece-${piece.row}-${piece.column}`;
            return (
              <g key={`piece-${piece.row}-${piece.column}`}>
                <path
                  d={piece.path}
                  className="fill-card"
                  filter="url(#board-404-paper)"
                />
                <g clipPath={`url(#${clipId})`} className="fill-foreground">
                  <path d={FOUR_GLYPH_PATH} transform={glyphTransform(0)} />
                  <path d={ZERO_GLYPH_PATH} transform={glyphTransform(1)} />
                  <path d={FOUR_GLYPH_PATH} transform={glyphTransform(2)} />
                </g>
                <path
                  d={piece.path}
                  fill="none"
                  className="stroke-border"
                  strokeWidth="1.05"
                />
                <path
                  d={piece.path}
                  transform="translate(0 0.85)"
                  fill="none"
                  stroke="rgb(255 255 255 / 0.62)"
                  strokeWidth="0.65"
                />
              </g>
            );
          })}

          {missingPieces.map(function renderHole(piece) {
            return (
              <path
                key={`hole-${piece.row}-${piece.column}`}
                d={piece.path}
                className="fill-background stroke-muted-foreground/35"
                strokeWidth="1.3"
              />
            );
          })}
        </g>
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
