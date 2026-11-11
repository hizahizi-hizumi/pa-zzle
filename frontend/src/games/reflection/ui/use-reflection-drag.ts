import { type MouseEvent, type PointerEvent, useRef, useState } from "react";

import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import type {
  ReflectionDragSource,
  ReflectionDropTarget,
} from "@/games/reflection/session/session";

export type ReflectionDragPreview = {
  source: ReflectionDragSource;
  piece: ReflectionPiece;
  x: number;
  y: number;
  target: ReflectionDropTarget | null;
};

type ActivePointer = {
  id: number;
  source: ReflectionDragSource;
  piece: ReflectionPiece;
  startX: number;
  startY: number;
  dragging: boolean;
};

export type ReflectionDragHandlers = {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => boolean;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => boolean;
};

const DRAG_START_DISTANCE_PX = 9;
const CLICK_AFTER_DRAG_MS = 700;

function getDropTarget(x: number, y: number): ReflectionDropTarget | null {
  const element = document.elementFromPoint(x, y);
  const cell = element?.closest<HTMLElement>("[data-reflection-cell-index]");
  if (cell) {
    const cellIndex = Number(cell.dataset.reflectionCellIndex);
    return Number.isInteger(cellIndex) ? { type: "cell", cellIndex } : null;
  }
  return element?.closest("[data-reflection-stock-zone]")
    ? { type: "stock" }
    : null;
}

/** タップ操作は既存のまま保ち、移動距離が閾値を超えた入力だけドラッグとして扱う。 */
export function useReflectionDrag(
  onDrop: (source: ReflectionDragSource, target: ReflectionDropTarget) => void,
): {
  preview: ReflectionDragPreview | null;
  getHandlers: (
    source: ReflectionDragSource,
    piece: ReflectionPiece | null,
  ) => ReflectionDragHandlers;
} {
  const activeRef = useRef<ActivePointer | null>(null);
  const lastDragRef = useRef<{
    time: number;
    x: number;
    y: number;
    pointerType: string;
  } | null>(null);
  const [preview, setPreview] = useState<ReflectionDragPreview | null>(null);

  function getHandlers(
    source: ReflectionDragSource,
    piece: ReflectionPiece | null,
  ): ReflectionDragHandlers {
    return {
      onPointerDown(event) {
        if (
          piece === null ||
          event.button !== 0 ||
          !event.isPrimary ||
          event.currentTarget.disabled
        )
          return;
        activeRef.current = {
          id: event.pointerId,
          source,
          piece,
          startX: event.clientX,
          startY: event.clientY,
          dragging: false,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove(event) {
        const active = activeRef.current;
        if (!active || active.id !== event.pointerId) return;
        if (
          !active.dragging &&
          Math.hypot(
            event.clientX - active.startX,
            event.clientY - active.startY,
          ) < DRAG_START_DISTANCE_PX
        )
          return;
        active.dragging = true;
        event.preventDefault();
        setPreview({
          source: active.source,
          piece: active.piece,
          x: event.clientX,
          y: event.clientY,
          target: getDropTarget(event.clientX, event.clientY),
        });
      },
      onPointerUp(event) {
        const active = activeRef.current;
        if (!active || active.id !== event.pointerId) return false;
        activeRef.current = null;
        if (!active.dragging) return false;
        const target = getDropTarget(event.clientX, event.clientY);
        setPreview(null);
        lastDragRef.current = {
          time: event.timeStamp,
          x: event.clientX,
          y: event.clientY,
          pointerType: event.pointerType,
        };
        if (target) onDrop(active.source, target);
        return true;
      },
      onPointerCancel(event) {
        if (activeRef.current?.id === event.pointerId) {
          activeRef.current = null;
          setPreview(null);
        }
      },
      onClick(event) {
        const lastDrag = lastDragRef.current;
        if (event.detail === 0 || lastDrag === null) return false;
        const elapsed = event.timeStamp - lastDrag.time;
        const clickMatchesDrag =
          elapsed >= 0 &&
          elapsed <
            (lastDrag.pointerType === "mouse" ? 100 : CLICK_AFTER_DRAG_MS) &&
          Math.hypot(event.clientX - lastDrag.x, event.clientY - lastDrag.y) <
            DRAG_START_DISTANCE_PX;
        if (!clickMatchesDrag) return false;
        lastDragRef.current = null;
        event.preventDefault();
        return true;
      },
    };
  }

  return { preview, getHandlers };
}
