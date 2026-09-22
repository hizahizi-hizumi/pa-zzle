import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

const detachedPiecePath =
  "M24 2H124V30C124 25 128 21 134 21C142 21 148 27 148 35C148 43 142 49 134 49C128 49 124 45 124 40V102H24V72C24 77 20 81 14 81C6 81 0 75 0 67C0 59 6 53 14 53C20 53 24 57 24 62V2Z";
const leftPiecePath =
  "M2 2H100V62C100 57 96 53 90 53C82 53 76 59 76 67C76 75 82 81 90 81C96 81 100 77 100 72V102H2V2Z";
const rightPiecePath =
  "M200 2H298V102H200V40C200 45 204 49 210 49C218 49 224 43 224 35C224 27 218 21 210 21C204 21 200 25 200 30V2Z";

const targetOffset = { x: 0, y: -132 } as const;
const snapRadius = 46;
const nearRadius = 72;

type Point = {
  x: number;
  y: number;
};

function distanceFromTarget(point: Point) {
  return Math.hypot(point.x - targetOffset.x, point.y - targetOffset.y);
}

export function MissingPageJigsaw() {
  const [isPlaced, setIsPlaced] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const dragStart = useRef<Point | null>(null);
  const isNearTarget =
    isDragging && distanceFromTarget(dragOffset) <= nearRadius;

  function placePiece() {
    setIsPlaced(true);
    setIsDragging(false);
    setDragOffset(targetOffset);
    dragStart.current = null;
  }

  function resetPiece() {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    dragStart.current = null;
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (isPlaced) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!isDragging || !dragStart.current) return;

    setDragOffset({
      x: event.clientX - dragStart.current.x,
      y: event.clientY - dragStart.current.y,
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!isDragging || !dragStart.current) return;

    const releasedOffset = {
      x: event.clientX - dragStart.current.x,
      y: event.clientY - dragStart.current.y,
    };

    if (distanceFromTarget(releasedOffset) <= snapRadius) {
      placePiece();
    } else {
      resetPiece();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (isPlaced || (event.key !== "Enter" && event.key !== " ")) return;

    event.preventDefault();
    placePiece();
  }

  const pieceTransform = isPlaced ? targetOffset : dragOffset;
  const pieceRotation = isPlaced ? 0 : isDragging ? -1 : -7;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-60 w-75 select-none">
        <svg
          aria-hidden="true"
          viewBox="0 0 300 104"
          className="absolute inset-x-0 top-0 w-full overflow-visible"
        >
          <path
            d={detachedPiecePath}
            transform="translate(76 0)"
            className={
              isNearTarget
                ? "fill-accent stroke-ring"
                : "fill-muted stroke-border"
            }
            strokeWidth="1.5"
          />

          <path
            d={leftPiecePath}
            className="fill-background stroke-brand-strong"
            strokeWidth="1.5"
          />
          <text
            x="49"
            y="69"
            textAnchor="middle"
            className="fill-brand-inverse text-[48px] font-bold"
          >
            4
          </text>

          <path
            d={rightPiecePath}
            className="fill-background stroke-brand-strong"
            strokeWidth="1.5"
          />
          <text
            x="251"
            y="69"
            textAnchor="middle"
            className="fill-brand-inverse text-[48px] font-bold"
          >
            4
          </text>
        </svg>

        <button
          type="button"
          aria-label={
            isPlaced
              ? "0のピースがはまりました"
              : "0のピースを空いた場所へドラッグして戻す"
          }
          aria-pressed={isPlaced}
          disabled={isPlaced}
          onKeyDown={handleKeyDown}
          onPointerCancel={resetPiece}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`absolute top-33 left-1/2 w-37 touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 ${
            isDragging
              ? "cursor-grabbing"
              : "cursor-grab transition-transform duration-(--duration-slow) ease-(--ease-enter)"
          }`}
          style={{
            transform: `translate(calc(-50% + ${pieceTransform.x}px), ${pieceTransform.y}px) rotate(${pieceRotation}deg)`,
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 148 106" className="w-full">
            <path
              d={detachedPiecePath}
              transform="translate(0 3)"
              className={`fill-brand-strong transition-opacity duration-(--duration-fast) ${
                isPlaced ? "opacity-0" : "opacity-25"
              }`}
            />
            <path
              d={detachedPiecePath}
              className="fill-brand-subtle stroke-brand-strong"
              strokeWidth="1.5"
            />
            <text
              x="74"
              y="69"
              textAnchor="middle"
              className="fill-brand-inverse text-[48px] font-bold"
            >
              0
            </text>
          </svg>
        </button>
      </div>

      <p className="text-meta text-muted-foreground" aria-live="polite">
        {isPlaced ? "ぴったり。" : "ピースをドラッグして戻す"}
      </p>
    </div>
  );
}
