import { type PointerEvent, type Ref, useRef, useState } from "react";

import type { SlidePuzzleDirection } from "@/games/slide-puzzle/puzzle/rules";
import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";
import type { SlidePuzzleSurface } from "@/games/slide-puzzle/ui/board/slide-puzzle-surface";

/** 盤面の幅を一辺のマス数で等分する。 */
const tileSizeClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "size-1/3",
  4: "size-1/4",
  5: "size-1/5",
};

type SlidePuzzleTileProps = {
  tile: SlidePuzzleTileNumber;
  cellIndex: number;
  boardSize: SlidePuzzleBoardSize;
  surface?: SlidePuzzleSurface;
  moveDirection?: SlidePuzzleDirection | null;
  gestureEnabled?: boolean;
  disabled: boolean;
  slideAnimated: boolean;
  faceRef: Ref<HTMLSpanElement>;
  onPress: (cellIndex: number) => void;
};

export function SlidePuzzleTile({
  tile,
  cellIndex,
  boardSize,
  surface = "original",
  moveDirection = null,
  gestureEnabled = false,
  disabled,
  slideAnimated,
  faceRef,
  onPress,
}: SlidePuzzleTileProps) {
  const row = getSlidePuzzleRow(cellIndex, boardSize);
  const column = getSlidePuzzleColumn(cellIndex, boardSize);
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(
    null,
  );
  const suppressNextPointerClick = useRef(false);
  const [previewOffset, setPreviewOffset] = useState(0);

  function dragDistance(event: PointerEvent<HTMLButtonElement>) {
    const start = pointerStart.current;
    if (!start || event.pointerId !== start.id) {
      return null;
    }
    return { x: event.clientX - start.x, y: event.clientY - start.y };
  }

  function alongSlideDirection(dx: number, dy: number) {
    switch (moveDirection) {
      case "up":
        return { forward: -dy, cross: dx };
      case "down":
        return { forward: dy, cross: dx };
      case "left":
        return { forward: -dx, cross: dy };
      case "right":
        return { forward: dx, cross: dy };
      default:
        return { forward: 0, cross: 0 };
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (
      !gestureEnabled ||
      disabled ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    suppressNextPointerClick.current = false;
    pointerStart.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const distance = dragDistance(event);
    if (!distance || !moveDirection) {
      return;
    }
    const { forward, cross } = alongSlideDirection(distance.x, distance.y);
    const preview =
      forward > Math.abs(cross)
        ? Math.min(forward, event.currentTarget.clientWidth * 0.27)
        : 0;
    setPreviewOffset(preview);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const distance = dragDistance(event);
    pointerStart.current = null;
    setPreviewOffset(0);
    if (!distance) {
      return;
    }
    const threshold = Math.max(10, event.currentTarget.clientWidth * 0.16);
    if (Math.hypot(distance.x, distance.y) < threshold) {
      return;
    }
    suppressNextPointerClick.current = true;
    const { forward, cross } = alongSlideDirection(distance.x, distance.y);
    if (moveDirection && forward >= threshold && forward > Math.abs(cross)) {
      onPress(cellIndex);
    }
  }

  function handlePointerCancel() {
    pointerStart.current = null;
    setPreviewOffset(0);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        if (suppressNextPointerClick.current && event.detail !== 0) {
          suppressNextPointerClick.current = false;
          return;
        }
        onPress(cellIndex);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`group absolute top-0 left-0 ${tileSizeClassByBoardSize[boardSize]} cursor-pointer ${gestureEnabled ? "touch-none" : "touch-manipulation"} select-none p-[1cqw] outline-none [-webkit-tap-highlight-color:transparent] ${
        slideAnimated
          ? "transition-transform duration-(--duration-normal) ease-enter motion-reduce:transition-none"
          : ""
      }`}
      style={{ transform: `translate(${column * 100}%, ${row * 100}%)` }}
    >
      <SlidePuzzleTileFace
        tile={tile}
        boardSize={boardSize}
        surface={surface}
        ref={faceRef}
        previewOffset={previewOffset}
        moveDirection={moveDirection}
      />
    </button>
  );
}
