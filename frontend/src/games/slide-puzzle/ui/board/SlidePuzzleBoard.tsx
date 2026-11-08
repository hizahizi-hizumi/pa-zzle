import {
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { getSlidePuzzleSlide } from "@/games/slide-puzzle/puzzle/rules";
import {
  findSlidePuzzleBlankIndex,
  getSlidePuzzleBoardSize,
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard as SlidePuzzleBoardState,
} from "@/games/slide-puzzle/puzzle/state";
import {
  CLEAR_WAVE_DURATION_MS,
  clearWaveKeyframes,
  getClearWaveTileDelayMs,
} from "@/games/slide-puzzle/ui/board/clear-wave";
import { SlidePuzzleTile } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleTile";
import type { SlidePuzzleExperience } from "@/games/slide-puzzle/ui/board/slide-puzzle-experience";
import {
  MOTION_EASING,
  playAnimations,
  playRejectionShake,
  type RejectionShakeTiming,
} from "@/lib/motion";

type SlidePuzzleBoardProps = {
  board: SlidePuzzleBoardState;
  operation: SlidePuzzleOperation | null;
  interactionDisabled: boolean;
  clearing: boolean;
  experience?: SlidePuzzleExperience;
  onSlideTile: (tileIndex: number) => void;
  onClearAnimationComplete: () => void;
};

const CLEAR_HOLD_MS = 240;
const POCKET_SLIDE_THRESHOLD_RATIO = 0.64;

const invalidTileShakeTiming: RejectionShakeTiming = {
  durationMs: 220,
  easing: "ease-out",
};

const invalidTileShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-5%)" },
  { transform: "translateX(5%)" },
  { transform: "translateX(-2.5%)" },
  { transform: "translateX(0)" },
];

const boardAppearance: Record<SlidePuzzleExperience, string> = {
  classic: "rounded-[1rem] bg-muted p-[1%]",
  kinetic:
    "rounded-[5cqw] bg-[#303941] p-[1.5%] shadow-[0_1.2cqw_0_#1f262c,0_3cqw_5cqw_rgb(17_22_25_/_0.18)] ring-1 ring-[#242b31]",
  pocket:
    "rounded-[2.8cqw] bg-[#c4d2cb] p-[1.6%] shadow-[inset_0_0.5cqw_1.5cqw_rgb(23_55_49_/_0.15)] ring-1 ring-[#99aea4]",
};

const blankAppearance: Record<
  Exclude<SlidePuzzleExperience, "classic">,
  string
> = {
  kinetic:
    "rounded-[1.5cqw] bg-[#1b232b] shadow-[inset_0_0.8cqw_1.5cqw_rgb(0_0_0_/_0.3)] ring-1 ring-[#45505a]",
  pocket:
    "rounded-[1cqw] bg-[#72988c] shadow-[inset_0_0.6cqw_1.1cqw_rgb(25_57_51_/_0.24)] ring-2 ring-[#dfeae1] cursor-grab active:cursor-grabbing",
};

type DragPreview = {
  movedTileIndices: readonly number[];
  offset: number;
  dragging: boolean;
};

type PocketPreview = {
  blankIndex: number;
  tileIndex: number;
  offset: number;
  x: number;
  y: number;
};

export function SlidePuzzleBoard({
  board,
  operation,
  interactionDisabled,
  clearing,
  experience = "classic",
  onSlideTile,
  onClearAnimationComplete,
}: SlidePuzzleBoardProps) {
  const tileFaceRefs = useRef(new Map<number, HTMLSpanElement>());
  const trackRef = useRef<HTMLDivElement>(null);
  const pocketPointer = useRef<number | null>(null);
  const pocketPending = useRef(false);
  const previousBlank = useRef<number | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [pocketPreview, setPocketPreview] = useState<PocketPreview | null>(
    null,
  );
  const boardSize = getSlidePuzzleBoardSize(board);
  const tileCount = board.length - 1;
  const blankIndex = findSlidePuzzleBlankIndex(board);
  const tiles = board
    .map((tile, cellIndex) => ({ tile, cellIndex }))
    .filter(({ tile }) => tile !== SLIDE_PUZZLE_BLANK)
    .sort((left, right) => left.tile - right.tile);

  useLayoutEffect(() => {
    if (previousBlank.current !== blankIndex) {
      pocketPending.current = false;
      previousBlank.current = blankIndex;
    }
  }, [blankIndex]);

  useLayoutEffect(() => {
    if (operation?.type !== "invalid") {
      return;
    }
    const tile = board[operation.tileIndex];
    playRejectionShake(
      tile === undefined ? undefined : tileFaceRefs.current.get(tile),
      invalidTileShakeKeyframes,
      invalidTileShakeTiming,
    );
  }, [board, operation]);

  useEffect(() => {
    if (!clearing) {
      return;
    }
    const facesInTileOrder = Array.from({ length: tileCount }, (_, index) =>
      tileFaceRefs.current.get(index + 1),
    );
    return playAnimations({
      animate: () => animateClearWave(facesInTileOrder),
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onClearAnimationComplete,
    });
  }, [clearing, onClearAnimationComplete, tileCount]);

  function handlePocketPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      experience !== "pocket" ||
      interactionDisabled ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      !(event.target instanceof Element) ||
      !event.target.closest("[data-slide-pocket]")
    ) {
      return;
    }
    pocketPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePocketPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (
      pocketPointer.current !== event.pointerId ||
      pocketPending.current ||
      interactionDisabled
    ) {
      return;
    }
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const cellWidth = rect.width / boardSize;
    const cellHeight = rect.height / boardSize;
    const gapRow = getSlidePuzzleRow(blankIndex, boardSize);
    const gapColumn = getSlidePuzzleColumn(blankIndex, boardSize);
    const distanceX =
      event.clientX - (rect.left + (gapColumn + 0.5) * cellWidth);
    const distanceY = event.clientY - (rect.top + (gapRow + 0.5) * cellHeight);
    const horizontal =
      Math.abs(distanceX / cellWidth) >= Math.abs(distanceY / cellHeight);
    const direction = horizontal ? Math.sign(distanceX) : Math.sign(distanceY);
    if (!direction) {
      setPocketPreview(null);
      return;
    }
    const adjacentIndex = blankIndex + direction * (horizontal ? 1 : boardSize);
    const slide = getSlidePuzzleSlide(board, adjacentIndex);
    if (slide?.movedTileIndices.length !== 1) {
      setPocketPreview(null);
      return;
    }
    const distance = horizontal ? Math.abs(distanceX) : Math.abs(distanceY);
    const cellSize = horizontal ? cellWidth : cellHeight;
    const offset = Math.min(distance, cellSize);
    if (offset >= cellSize * POCKET_SLIDE_THRESHOLD_RATIO) {
      pocketPending.current = true;
      setPocketPreview(null);
      onSlideTile(adjacentIndex);
      return;
    }
    setPocketPreview({
      blankIndex,
      tileIndex: adjacentIndex,
      offset,
      x: horizontal ? direction * offset : 0,
      y: horizontal ? 0 : direction * offset,
    });
  }

  function handlePocketPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (pocketPointer.current === event.pointerId) {
      pocketPointer.current = null;
      pocketPending.current = false;
      setPocketPreview(null);
    }
  }

  const isPocket = experience === "pocket";
  const blankRow = getSlidePuzzleRow(blankIndex, boardSize);
  const blankColumn = getSlidePuzzleColumn(blankIndex, boardSize);
  const activePocketPreview =
    pocketPreview?.blankIndex === blankIndex ? pocketPreview : null;

  return (
    <div
      role="group"
      aria-label="盤面"
      className={`@container size-full ${boardAppearance[experience]}`}
    >
      <div
        ref={trackRef}
        className="relative size-full"
        onPointerDown={handlePocketPointerDown}
        onPointerMove={handlePocketPointerMove}
        onPointerUp={handlePocketPointerEnd}
        onPointerCancel={handlePocketPointerEnd}
      >
        {experience !== "classic" && (
          <div
            data-slide-pocket={isPocket ? "" : undefined}
            role={isPocket ? "button" : undefined}
            aria-label={isPocket ? "空白を動かす" : undefined}
            className={`absolute top-0 left-0 flex items-center justify-center p-[1cqw] ${isPocket ? "touch-none" : "pointer-events-none"}`}
            style={{
              width: `${100 / boardSize}%`,
              height: `${100 / boardSize}%`,
              transform: `translate(${blankColumn * 100}%, ${blankRow * 100}%) translate(${activePocketPreview?.x ?? 0}px, ${activePocketPreview?.y ?? 0}px)`,
              transition: activePocketPreview
                ? "none"
                : operation !== null
                  ? "transform 150ms cubic-bezier(.2,.8,.2,1)"
                  : undefined,
            }}
          >
            <span
              className={`flex size-full items-center justify-center ${blankAppearance[experience]}`}
            >
              {isPocket && (
                <span
                  aria-hidden="true"
                  className="size-[22%] rounded-full border-[0.6cqw] border-[#e2eee8] opacity-90 shadow-[0_0_0_0.5cqw_rgb(33_74_64_/_0.2)]"
                />
              )}
            </span>
          </div>
        )}
        {tiles.map(({ tile, cellIndex }) => {
          const slide = getSlidePuzzleSlide(board, cellIndex);
          const shown =
            dragPreview?.movedTileIndices.includes(cellIndex) === true;
          const pocketDragged = activePocketPreview?.tileIndex === cellIndex;
          return (
            <SlidePuzzleTile
              key={tile}
              tile={tile}
              cellIndex={cellIndex}
              boardSize={boardSize}
              disabled={interactionDisabled}
              slideAnimated={operation !== null}
              experience={experience}
              slideDirection={slide?.direction ?? null}
              dragOffset={
                pocketDragged
                  ? activePocketPreview.offset
                  : shown
                    ? dragPreview.offset
                    : 0
              }
              dragging={pocketDragged || (shown && dragPreview.dragging)}
              faceRef={(element) => {
                if (element) {
                  tileFaceRefs.current.set(tile, element);
                } else {
                  tileFaceRefs.current.delete(tile);
                }
              }}
              onDragPreview={(offset, dragging) => {
                setDragPreview(
                  slide && (dragging || offset > 0)
                    ? {
                        movedTileIndices: slide.movedTileIndices,
                        offset,
                        dragging,
                      }
                    : null,
                );
              }}
              onPress={onSlideTile}
            />
          );
        })}
      </div>
    </div>
  );
}

function animateClearWave(
  elements: readonly (HTMLElement | undefined)[],
): Animation[] {
  return elements.flatMap(
    (element, order) =>
      element?.animate?.(clearWaveKeyframes, {
        duration: CLEAR_WAVE_DURATION_MS,
        delay: getClearWaveTileDelayMs(order),
        easing: MOTION_EASING.celebrate,
      }) ?? [],
  );
}
