import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

type Point = {
  x: number;
  y: number;
};

type UseSnapPieceOptions = {
  targetOffset: Point;
  snapRadius: number;
};

function distanceBetween(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function useSnapPiece({
  targetOffset,
  snapRadius,
}: UseSnapPieceOptions) {
  const [isPlaced, setIsPlaced] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const dragStart = useRef<Point | null>(null);

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

    if (distanceBetween(releasedOffset, targetOffset) <= snapRadius) {
      placePiece();
      return;
    }

    resetPiece();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (isPlaced || (event.key !== "Enter" && event.key !== " ")) return;

    event.preventDefault();
    placePiece();
  }

  return {
    dragOffset,
    handleKeyDown,
    handlePointerCancel: resetPiece,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isDragging,
    isNearTarget:
      isDragging &&
      distanceBetween(dragOffset, targetOffset) <= snapRadius * 1.55,
    isPlaced,
  };
}
