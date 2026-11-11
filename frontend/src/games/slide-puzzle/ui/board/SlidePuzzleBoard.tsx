import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { getSlidePuzzleSlide } from "@/games/slide-puzzle/puzzle/rules";
import {
  findSlidePuzzleBlankIndex,
  getSlidePuzzleBoardSize,
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard as SlidePuzzleBoardState,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import {
  CLEAR_WAVE_DURATION_MS,
  getClearWaveTileDelayMs,
  woodworkClearKeyframes,
} from "@/games/slide-puzzle/ui/board/clear-wave";
import { SlidePuzzleBlankSpotlight } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleBlankSpotlight";
import { SlidePuzzleTile } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleTile";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";
import "@/games/slide-puzzle/ui/board/slide-puzzle-visual.css";
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
  /** タイルに重ねる合図。1枚に1つまで。 */
  cues?: readonly SlidePuzzleTileCue[];
  /**
   * チュートリアルで手を引いている間、画面全体の覆いから抜いて元の明るさで見せるタイル。`null` なら抜かない。通常のプレイでは渡さない。
   * 抜くときは、タイルが収まる空白も決め手として抜く。
   */
  spotlitTiles?: readonly SlidePuzzleTileNumber[] | null;
  onSlideTile: (tileIndex: number) => void;
  onClearAnimationComplete: () => void;
};

const CLEAR_HOLD_MS = 300;

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

type DragPreview = {
  movedTileIndices: readonly number[];
  offset: number;
  dragging: boolean;
};

export function SlidePuzzleBoard({
  board,
  operation,
  interactionDisabled,
  clearing,
  cues = [],
  spotlitTiles = null,
  onSlideTile,
  onClearAnimationComplete,
}: SlidePuzzleBoardProps) {
  const tileFaceRefs = useRef(new Map<number, HTMLSpanElement>());
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const boardSize = getSlidePuzzleBoardSize(board);
  const tileCount = board.length - 1;
  const blankIndex = findSlidePuzzleBlankIndex(board);
  const tiles = board
    .map((tile, cellIndex) => ({ tile, cellIndex }))
    .filter(({ tile }) => tile !== SLIDE_PUZZLE_BLANK)
    .sort((left, right) => left.tile - right.tile);

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

  const blankRow = getSlidePuzzleRow(blankIndex, boardSize);
  const blankColumn = getSlidePuzzleColumn(blankIndex, boardSize);

  return (
    <div
      role="group"
      aria-label="盤面"
      data-slide-size={boardSize}
      data-slide-clearing={clearing}
      className="slide-board @container size-full"
    >
      <div className="slide-track relative size-full">
        {spotlitTiles !== null && (
          <SlidePuzzleBlankSpotlight
            cellIndex={board.indexOf(SLIDE_PUZZLE_BLANK)}
            boardSize={boardSize}
          />
        )}
        <div
          className="slide-tile pointer-events-none absolute top-0 left-0 flex items-center justify-center"
          style={{
            width: `${100 / boardSize}%`,
            height: `${100 / boardSize}%`,
            transform: `translate(${blankColumn * 100}%, ${blankRow * 100}%)`,
            transition:
              operation !== null
                ? "transform 190ms cubic-bezier(.19,.85,.28,1)"
                : undefined,
          }}
        >
          <span className="slide-blank flex size-full items-center justify-center" />
        </div>
        {tiles.map(({ tile, cellIndex }) => {
          const slide = getSlidePuzzleSlide(board, cellIndex);
          const shown =
            dragPreview?.movedTileIndices.includes(cellIndex) === true;
          return (
            <SlidePuzzleTile
              key={tile}
              tile={tile}
              cellIndex={cellIndex}
              boardSize={boardSize}
              disabled={interactionDisabled}
              cue={cues.find((cue) => cue.tile === tile)}
              spotlit={spotlitTiles?.includes(tile) ?? false}
              slideAnimated={operation !== null}
              slideDirection={slide?.direction ?? null}
              dragOffset={shown ? dragPreview.offset : 0}
              dragging={shown && dragPreview.dragging}
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
      element?.animate?.(woodworkClearKeyframes, {
        duration: CLEAR_WAVE_DURATION_MS,
        delay: getClearWaveTileDelayMs(order, elements.length),
        easing: MOTION_EASING.celebrate,
      }) ?? [],
  );
}
