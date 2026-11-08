import { type PointerEvent, type Ref, useRef } from "react";

import type { SlidePuzzleDirection } from "@/games/slide-puzzle/puzzle/rules";
import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";
import type { SlidePuzzleExperience } from "@/games/slide-puzzle/ui/board/slide-puzzle-experience";

const tileSizeClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "size-1/3",
  4: "size-1/4",
  5: "size-1/5",
};

const SLIDE_DRAG_THRESHOLD_RATIO = 0.22;

type DragStart = {
  pointerId: number;
  x: number;
  y: number;
  distance: number;
};

type SlidePuzzleTileProps = {
  tile: SlidePuzzleTileNumber;
  cellIndex: number;
  boardSize: SlidePuzzleBoardSize;
  disabled: boolean;
  slideAnimated: boolean;
  experience: SlidePuzzleExperience;
  slideDirection: SlidePuzzleDirection | null;
  dragOffset: number;
  dragging: boolean;
  faceRef: Ref<HTMLSpanElement>;
  onDragPreview: (offset: number, dragging: boolean) => void;
  onPress: (cellIndex: number) => void;
};

function forwardDragDistance(
  direction: SlidePuzzleDirection,
  deltaX: number,
  deltaY: number,
): number {
  switch (direction) {
    case "up":
      return -deltaY;
    case "down":
      return deltaY;
    case "left":
      return -deltaX;
    case "right":
      return deltaX;
  }
}

export function SlidePuzzleTile({
  tile,
  cellIndex,
  boardSize,
  disabled,
  slideAnimated,
  experience,
  slideDirection,
  dragOffset,
  dragging,
  faceRef,
  onDragPreview,
  onPress,
}: SlidePuzzleTileProps) {
  const row = getSlidePuzzleRow(cellIndex, boardSize);
  const column = getSlidePuzzleColumn(cellIndex, boardSize);
  const drag = useRef<DragStart | null>(null);
  const suppressClick = useRef(false);
  const canDrag = experience === "kinetic" && slideDirection !== null;

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (
      !canDrag ||
      disabled ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      distance: event.currentTarget.clientWidth,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId || !slideDirection) {
      return;
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const distance = forwardDragDistance(slideDirection, deltaX, deltaY);
    const crossDistance = Math.abs(
      slideDirection === "left" || slideDirection === "right" ? deltaY : deltaX,
    );
    const offset =
      crossDistance > Math.max(distance, 10)
        ? 0
        : Math.max(0, Math.min(distance, start.distance));
    onDragPreview(offset, true);
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId || !slideDirection) {
      return;
    }
    drag.current = null;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const distance = forwardDragDistance(slideDirection, deltaX, deltaY);
    const crossDistance = Math.abs(
      slideDirection === "left" || slideDirection === "right" ? deltaY : deltaX,
    );
    const qualifies =
      event.type === "pointerup" &&
      distance >= start.distance * SLIDE_DRAG_THRESHOLD_RATIO &&
      crossDistance <= distance;
    onDragPreview(0, false);
    if (qualifies) {
      suppressClick.current = true;
      onPress(cellIndex);
    }
  }

  function handleClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onPress(cellIndex);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={`group absolute top-0 left-0 ${tileSizeClassByBoardSize[boardSize]} cursor-pointer select-none p-[1cqw] outline-none [-webkit-tap-highlight-color:transparent] ${
        canDrag ? "touch-none" : "touch-manipulation"
      } ${
        slideAnimated
          ? "transition-transform duration-(--duration-normal) ease-enter motion-reduce:transition-none"
          : ""
      }`}
      style={{ transform: `translate(${column * 100}%, ${row * 100}%)` }}
    >
      <SlidePuzzleTileFace
        tile={tile}
        boardSize={boardSize}
        experience={experience}
        dragOffset={dragOffset}
        slideDirection={slideDirection}
        dragging={dragging}
        ref={faceRef}
      />
    </button>
  );
}
