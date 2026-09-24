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
      ? 0
      : startX < 130
        ? -4
        : 4;

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
        </defs>

        <path
          d={piecePath}
          className="fill-card stroke-border"
          strokeWidth="1"
        />
        <g
          clipPath={`url(#loose-board-clip-${pieceX}-${pieceY})`}
          className="fill-muted-foreground opacity-45"
        >
          <path d={FOUR_GLYPH_PATH} transform={glyphTransform(0)} />
          <path d={ZERO_GLYPH_PATH} transform={glyphTransform(1)} />
          <path d={FOUR_GLYPH_PATH} transform={glyphTransform(2)} />
        </g>
      </svg>
    </button>
  );
}
