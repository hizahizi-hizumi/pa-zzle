import { type MouseEvent, type PointerEvent, type Ref, useRef } from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { SlidePuzzleDirection } from "@/games/slide-puzzle/puzzle/rules";
import {
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";

export const tileSizeClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "size-1/3",
  4: "size-1/4",
  5: "size-1/5",
};

/** タイルの面の位置と角丸。印と応えはこの形で囲み、手を引く間はこの形のまま覆いから抜く。 */
export const tileFaceShapeClassName = "inset-[0.57cqw] rounded-[0.28cqw]";

const cuePlacementClassName = `pointer-events-none absolute ${tileFaceShapeClassName}`;
const SLIDE_DRAG_THRESHOLD_RATIO = 0.22;
const TAP_SLOP_PX = 8;

type DragStart = {
  pointerId: number;
  x: number;
  y: number;
  distance: number;
  maxTravel: number;
};

type SlidePuzzleTileProps = {
  tile: SlidePuzzleTileNumber;
  cellIndex: number;
  boardSize: SlidePuzzleBoardSize;
  disabled: boolean;
  cue: SlidePuzzleTileCue | undefined;
  /** チュートリアルで手を引いている間、画面全体の覆いからこのタイルを抜き、元の明るさで見せる。 */
  spotlit: boolean;
  slideAnimated: boolean;
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
  cue,
  spotlit,
  slideAnimated,
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
  const canDrag = slideDirection !== null;
  const dragTranslate =
    dragOffset === 0 || slideDirection === null
      ? undefined
      : slideDirection === "left"
        ? `${-dragOffset}px 0px`
        : slideDirection === "right"
          ? `${dragOffset}px 0px`
          : slideDirection === "up"
            ? `0px ${-dragOffset}px`
            : `0px ${dragOffset}px`;

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (
      !canDrag ||
      disabled ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    suppressClick.current = false;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      distance: event.currentTarget.clientWidth,
      maxTravel: 0,
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
    start.maxTravel = Math.max(start.maxTravel, Math.hypot(deltaX, deltaY));
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
    const travel = Math.max(start.maxTravel, Math.hypot(deltaX, deltaY));
    suppressClick.current =
      event.type === "pointercancel" || qualifies || travel >= TAP_SLOP_PX;
    onDragPreview(0, false);
    if (qualifies) {
      onPress(cellIndex);
    }
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const suppressedPointerClick = suppressClick.current && event.detail !== 0;
    suppressClick.current = false;
    if (!suppressedPointerClick) {
      onPress(cellIndex);
    }
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
      data-slide-moving={slideAnimated}
      className={`group absolute top-0 left-0 ${tileSizeClassByBoardSize[boardSize]} cursor-pointer select-none slide-tile outline-none [-webkit-tap-highlight-color:transparent] ${
        canDrag ? "touch-none" : "touch-manipulation"
      } ${
        slideAnimated
          ? "transition-transform duration-(--duration-normal) ease-enter motion-reduce:transition-none"
          : ""
      }`}
      style={{ transform: `translate(${column * 100}%, ${row * 100}%)` }}
    >
      <span
        data-slide-dragging={dragging}
        className="slide-tile-content relative block size-full"
        style={{ translate: dragTranslate }}
      >
        <SlidePuzzleTileFace tile={tile} dragging={dragging} ref={faceRef} />
        <TutorialSpotlight
          active={spotlit}
          className={tileFaceShapeClassName}
        />
        {cue?.kind === "landed" && (
          <span
            aria-hidden="true"
            data-tile-cue={cue.kind}
            className={cuePlacementClassName}
          >
            <TutorialCue kind="acknowledgement" id={cue.id} />
          </span>
        )}
        {(cue?.kind === "hint" || cue?.kind === "recall") && (
          <span
            aria-hidden="true"
            data-tile-cue="hint"
            className={cuePlacementClassName}
          >
            <TutorialCue
              kind="mark"
              recallId={cue.kind === "recall" ? cue.id : null}
            />
          </span>
        )}
      </span>
    </button>
  );
}
