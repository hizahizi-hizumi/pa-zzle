import { type MouseEvent, type PointerEvent, useRef, useState } from "react";

import type { BoardPoint } from "@/views/NotFoundView/jigsawLayout";

/** 外れている / 離せばはまる距離にある / はまった。 */
export type SnapPieceStatus = "loose" | "near" | "placed";

type UseSnapPieceOptions = {
  onStatusChange: (status: SnapPieceStatus) => void;
  snapRadius: number;
  status: SnapPieceStatus;
  targetOffset: BoardPoint;
};

type ActivePointer = {
  origin: BoardPoint;
  pointerId: number;
};

const primaryButton = 0;
const snapVibrationMs = 12;

/**
 * 外れたピースをドラッグして穴へはめる操作。配置状態は利用側が所有し、
 * このhookはドラッグ中の一時的な移動量だけを持つ。
 */
export function useSnapPiece({
  onStatusChange,
  snapRadius,
  status,
  targetOffset,
}: UseSnapPieceOptions) {
  const [dragOffset, setDragOffset] = useState<BoardPoint | null>(null);
  const activePointer = useRef<ActivePointer | null>(null);
  const isPlaced = status === "placed";

  function reportStatus(nextStatus: SnapPieceStatus) {
    if (nextStatus !== status) {
      onStatusChange(nextStatus);
    }
  }

  function isWithinSnapRadius(offset: BoardPoint) {
    return (
      Math.hypot(offset.x - targetOffset.x, offset.y - targetOffset.y) <=
      snapRadius
    );
  }

  function isActivePointer(event: PointerEvent<HTMLElement>) {
    return activePointer.current?.pointerId === event.pointerId;
  }

  function offsetFromOrigin(event: PointerEvent<HTMLElement>): BoardPoint {
    const origin = activePointer.current?.origin ?? {
      x: event.clientX,
      y: event.clientY,
    };
    return { x: event.clientX - origin.x, y: event.clientY - origin.y };
  }

  function endDrag() {
    activePointer.current = null;
    setDragOffset(null);
  }

  function placePiece() {
    endDrag();
    navigator.vibrate?.(snapVibrationMs);
    reportStatus("placed");
  }

  function returnPiece() {
    endDrag();
    reportStatus("loose");
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (
      isPlaced ||
      event.button !== primaryButton ||
      activePointer.current !== null
    ) {
      return;
    }

    event.preventDefault();
    // jsdom など Pointer Capture を持たない環境でも、ドラッグ自体は要素上のイベントで成立させる。
    event.currentTarget.setPointerCapture?.(event.pointerId);
    activePointer.current = {
      origin: { x: event.clientX, y: event.clientY },
      pointerId: event.pointerId,
    };
    setDragOffset({ x: 0, y: 0 });
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (!isActivePointer(event)) return;

    const offset = offsetFromOrigin(event);
    setDragOffset(offset);
    reportStatus(isWithinSnapRadius(offset) ? "near" : "loose");
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (!isActivePointer(event)) return;

    if (isWithinSnapRadius(offsetFromOrigin(event))) {
      placePiece();
      return;
    }
    returnPiece();
  }

  function handlePointerInterrupt(event: PointerEvent<HTMLElement>) {
    if (!isActivePointer(event)) return;

    returnPiece();
  }

  // ポインタ以外の起動（Enter / Space、スイッチコントロールなど）は detail が 0 の click になる。
  function handleClick(event: MouseEvent<HTMLElement>) {
    if (isPlaced || event.detail !== 0) return;

    placePiece();
  }

  return {
    dragOffset,
    handleClick,
    handleLostPointerCapture: handlePointerInterrupt,
    handlePointerCancel: handlePointerInterrupt,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isPlaced,
  };
}
