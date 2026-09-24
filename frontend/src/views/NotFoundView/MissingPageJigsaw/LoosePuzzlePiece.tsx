import type { ReactNode } from "react";

import { useSnapPiece } from "@/views/NotFoundView/MissingPageJigsaw/useSnapPiece";

type LoosePuzzlePieceProps = {
  ariaName: string;
  children: ReactNode;
  colorClassName?: string;
  height: number;
  placedAriaName: string;
  piecePath: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  viewBox: string;
  width: number;
};

export function LoosePuzzlePiece({
  ariaName,
  children,
  colorClassName = "fill-card stroke-border",
  height,
  placedAriaName,
  piecePath,
  startX,
  startY,
  targetX,
  targetY,
  viewBox,
  width,
}: LoosePuzzlePieceProps) {
  const targetOffset = {
    x: targetX - startX,
    y: targetY - startY,
  };
  const piece = useSnapPiece({ targetOffset, snapRadius: 28 });
  const offset = piece.isPlaced ? targetOffset : piece.dragOffset;
  const rotation =
    piece.isPlaced || piece.isDragging ? 0 : startX < targetX ? -4 : 4;

  return (
    <button
      type="button"
      aria-label={piece.isPlaced ? placedAriaName : ariaName}
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
        height,
        left: startX,
        top: startY,
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
        transition: piece.isDragging
          ? undefined
          : "transform var(--duration-slow) var(--ease-enter)",
        width,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={viewBox}
        className="h-full w-full overflow-visible"
      >
        <defs>
          <clipPath id={`loose-piece-${startX}-${startY}`}>
            <path d={piecePath} />
          </clipPath>
        </defs>
        <path d={piecePath} className={colorClassName} strokeWidth="1" />
        <g clipPath={`url(#loose-piece-${startX}-${startY})`}>{children}</g>
      </svg>
    </button>
  );
}
