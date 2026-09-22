import {
  FOUR_GLYPH_PATH,
  glyphTransform,
  ZERO_GLYPH_PATH,
} from "@/views/NotFoundView/MissingPageJigsaw/board404Art";
import { useSnapPiece } from "@/views/NotFoundView/MissingPageJigsaw/useSnapPiece";

type LooseBoardPieceProps = {
  accessibleName: string;
  placedName: string;
  piecePath: string;
  pieceX: number;
  pieceY: number;
  startX: number;
  startY: number;
};

const padding = 14;
const buttonSize = 80;

export function LooseBoardPiece({
  accessibleName,
  placedName,
  piecePath,
  pieceX,
  pieceY,
  startX,
  startY,
}: LooseBoardPieceProps) {
  const targetOffset = {
    x: pieceX - padding - startX,
    y: pieceY - padding - startY,
  };
  const piece = useSnapPiece({ targetOffset, snapRadius: 30 });
  const offset = piece.isPlaced ? targetOffset : piece.dragOffset;
  const rotation = piece.isPlaced
    ? 0
    : piece.isDragging
      ? -1
      : startX < 130
        ? -7
        : 6;

  return (
    <button
      type="button"
      aria-label={piece.isPlaced ? placedName : accessibleName}
      aria-pressed={piece.isPlaced}
      disabled={piece.isPlaced}
      onKeyDown={piece.handleKeyDown}
      onPointerCancel={piece.handlePointerCancel}
      onPointerDown={piece.handlePointerDown}
      onPointerMove={piece.handlePointerMove}
      onPointerUp={piece.handlePointerUp}
      className={`absolute touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 ${
        piece.isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        height: buttonSize,
        left: startX,
        top: startY,
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
        transition: piece.isDragging
          ? undefined
          : "transform var(--duration-slow) var(--ease-enter)",
        width: buttonSize,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={`${pieceX - padding} ${pieceY - padding} ${buttonSize} ${buttonSize}`}
        className="h-full w-full overflow-visible"
      >
        <defs>
          <clipPath id={`loose-board-clip-${pieceX}-${pieceY}`}>
            <path d={piecePath} />
          </clipPath>
          <filter
            id={`loose-board-shadow-${pieceX}-${pieceY}`}
            x="-40%"
            y="-40%"
            width="180%"
            height="210%"
          >
            <feDropShadow
              dx="0"
              dy="7"
              stdDeviation="6"
              floodColor="rgb(15 23 42 / 0.22)"
            />
          </filter>
        </defs>

        <g filter={`url(#loose-board-shadow-${pieceX}-${pieceY})`}>
          <path
            d={piecePath}
            transform="translate(0 3)"
            className="fill-muted-foreground opacity-40"
          />
          <path
            d={piecePath}
            className="fill-card stroke-border"
            strokeWidth="1.1"
          />
          <g clipPath={`url(#loose-board-clip-${pieceX}-${pieceY})`}>
            <g className="fill-foreground">
              <path d={FOUR_GLYPH_PATH} transform={glyphTransform(0)} />
              <path d={ZERO_GLYPH_PATH} transform={glyphTransform(1)} />
              <path d={FOUR_GLYPH_PATH} transform={glyphTransform(2)} />
            </g>
            <path
              d={piecePath}
              transform="translate(0 1)"
              fill="none"
              stroke="rgb(255 255 255 / 0.7)"
              strokeWidth="0.8"
            />
          </g>
        </g>
      </svg>
    </button>
  );
}
