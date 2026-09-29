import { type ReactNode, useId } from "react";

import type { BoardPoint } from "@/views/NotFoundView/jigsawLayout";
import { seamStrokeClassNames } from "@/views/NotFoundView/seamStroke";
import {
  type SnapPieceStatus,
  useSnapPiece,
} from "@/views/NotFoundView/useSnapPiece";

type LoosePuzzlePieceProps = {
  /** ピースに印刷された絵柄。盤面と同じ座標で描く。 */
  children: ReactNode;
  label: string;
  onStatusChange: (status: SnapPieceStatus) => void;
  path: string;
  pieceSize: number;
  placedLabel: string;
  slot: BoardPoint;
  snapRadius: number;
  start: BoardPoint;
  status: SnapPieceStatus;
  tabExtent: number;
};

const looseTiltDegrees = 4;
// フォーカスリングと傾きが要素の外へはみ出さない余白。
const ringAllowance = 4;

export function LoosePuzzlePiece({
  children,
  label,
  onStatusChange,
  path,
  pieceSize,
  placedLabel,
  slot,
  snapRadius,
  start,
  status,
  tabExtent,
}: LoosePuzzlePieceProps) {
  const clipPathId = useId();
  const targetOffset = { x: slot.x - start.x, y: slot.y - start.y };
  const piece = useSnapPiece({
    onStatusChange,
    snapRadius,
    status,
    targetOffset,
  });
  const isDragging = piece.dragOffset !== null;
  const offset = piece.isPlaced
    ? targetOffset
    : (piece.dragOffset ?? { x: 0, y: 0 });
  const tilt =
    piece.isPlaced || isDragging
      ? 0
      : start.x < slot.x
        ? -looseTiltDegrees
        : looseTiltDegrees;
  const strokeWidth = piece.isPlaced ? 2.5 : 3;
  const padding = tabExtent + ringAllowance;
  const boxSize = pieceSize + padding * 2;

  return (
    <button
      type="button"
      aria-label={piece.isPlaced ? placedLabel : label}
      aria-disabled={piece.isPlaced}
      onClick={piece.handleClick}
      onLostPointerCapture={piece.handleLostPointerCapture}
      onPointerCancel={piece.handlePointerCancel}
      onPointerDown={piece.handlePointerDown}
      onPointerMove={piece.handlePointerMove}
      onPointerUp={piece.handlePointerUp}
      className={`group absolute touch-none select-none outline-none ${
        isDragging
          ? "z-20 cursor-grabbing"
          : "z-10 transition-transform duration-(--duration-slow) ease-enter motion-reduce:transition-none"
      } ${piece.isPlaced ? "cursor-default" : isDragging ? "" : "cursor-grab"}`}
      style={{
        height: boxSize,
        left: start.x - padding,
        top: start.y - padding,
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${tilt}deg)`,
        width: boxSize,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={`${slot.x - padding} ${slot.y - padding} ${boxSize} ${boxSize}`}
        className="h-full w-full overflow-visible"
      >
        <defs>
          <clipPath id={clipPathId}>
            <path d={path} />
          </clipPath>
        </defs>
        <path
          d={path}
          fill="none"
          className="stroke-ring/50 opacity-0 group-focus-visible:opacity-100"
          strokeWidth="6"
        />
        <path d={path} className="fill-background" />
        <path
          d={path}
          fill="none"
          className={seamStrokeClassNames.back}
          strokeWidth={strokeWidth}
        />
        <g clipPath={`url(#${clipPathId})`}>{children}</g>
        <path
          d={path}
          fill="none"
          className={seamStrokeClassNames.front}
          strokeWidth={strokeWidth}
        />
      </svg>
    </button>
  );
}
