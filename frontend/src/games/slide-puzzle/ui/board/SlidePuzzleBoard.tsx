import { useEffect, useLayoutEffect, useRef } from "react";

import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type { SlidePuzzleTileDirection } from "@/games/slide-puzzle/puzzle/rules";
import {
  getSlidePuzzleBoardSize,
  listSlidePuzzleLineCellIndices,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard as SlidePuzzleBoardState,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import {
  CLEAR_LAST_PIECE_DELAY_MS,
  CLEAR_LAST_PIECE_DURATION_MS,
  CLEAR_LAST_PIECE_EASING,
  CLEAR_WAVE_DURATION_MS,
  clearLastPieceKeyframes,
  clearWaveKeyframes,
  getClearWaveTileDelayMs,
} from "@/games/slide-puzzle/ui/board/clear-wave";
import { SlidePuzzleBlankSpotlight } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleBlankSpotlight";
import {
  SlidePuzzleTile,
  tileSizeClassByBoardSize,
} from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleTile";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";
import { isSlidePuzzleSwipeTowardBlank } from "@/games/slide-puzzle/ui/board/tile-swipe";
import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  playAnimations,
  playRejectionShake,
  prefersReducedMotion,
  type RejectionShakeTiming,
} from "@/lib/motion";

type SlidePuzzleBoardProps = {
  board: SlidePuzzleBoardState;
  operation: SlidePuzzleOperation | null;
  interactionDisabled: boolean;
  clearing: boolean;
  /** タイルに重ねる合図。1枚に1つまで。 */
  cues?: readonly SlidePuzzleTileCue[];
  spotlitTiles?: readonly SlidePuzzleTileNumber[] | null;
  onSlideTile: (tileIndex: number) => void;
  onClearAnimationComplete: () => void;
};

const CLEAR_HOLD_MS = 240;

const invalidTileShakeTiming: RejectionShakeTiming = {
  durationMs: 220,
  easing: "ease-out",
};

/** そろった行・列を、端から順に持ち上げる。 */
const ALIGNED_LINE_LIFT_DURATION_MS = 320;
const ALIGNED_LINE_LIFT_STAGGER_MS = 36;
const alignedLineLiftKeyframes: Keyframe[] = [
  { transform: "translateY(0)" },
  {
    transform: "translateY(-9%)",
    boxShadow: "0 8px 12px rgb(0 0 0 / 0.14)",
    offset: 0.4,
  },
  { transform: "translateY(0)" },
];

const invalidTileShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-5%)" },
  { transform: "translateX(5%)" },
  { transform: "translateX(-2.5%)" },
  { transform: "translateX(0)" },
];

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
  const lastPieceRef = useRef<HTMLSpanElement>(null);
  const boardSize = getSlidePuzzleBoardSize(board);
  const tileCount = board.length - 1;
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

  // そろった行・列は、タイルが滑り終えてから持ち上げる。
  useLayoutEffect(() => {
    if (
      operation?.type !== "slid" ||
      operation.alignedLines.length === 0 ||
      prefersReducedMotion()
    ) {
      return;
    }
    const size = getSlidePuzzleBoardSize(operation.boardAfter);
    for (const line of operation.alignedLines) {
      for (const [order, cellIndex] of listSlidePuzzleLineCellIndices(
        line,
        size,
      ).entries()) {
        const tile = operation.boardAfter[cellIndex];
        const face =
          tile === undefined ? undefined : tileFaceRefs.current.get(tile);
        face?.animate?.(alignedLineLiftKeyframes, {
          duration: ALIGNED_LINE_LIFT_DURATION_MS,
          delay:
            MOTION_DURATION_MS.normal + order * ALIGNED_LINE_LIFT_STAGGER_MS,
          easing: MOTION_EASING.celebrate,
        });
      }
    }
  }, [operation]);

  useEffect(() => {
    if (!clearing) {
      return;
    }

    const facesInTileOrder = [
      ...Array.from({ length: tileCount }, (_, index) =>
        tileFaceRefs.current.get(index + 1),
      ),
      lastPieceRef.current ?? undefined,
    ];
    return playAnimations({
      animate: () => [
        ...animateLastPiece(lastPieceRef.current),
        ...animateClearWave(facesInTileOrder),
      ],
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onClearAnimationComplete,
    });
  }, [clearing, onClearAnimationComplete, tileCount]);

  function handleSwipe(cellIndex: number, direction: SlidePuzzleTileDirection) {
    if (
      !interactionDisabled &&
      isSlidePuzzleSwipeTowardBlank(board, cellIndex, direction)
    ) {
      onSlideTile(cellIndex);
    }
  }

  return (
    <div
      role="group"
      aria-label="盤面"
      className="@container size-full rounded-[1rem] bg-muted p-[1%]"
    >
      <div className="relative size-full">
        {spotlitTiles !== null && (
          <SlidePuzzleBlankSpotlight
            cellIndex={board.indexOf(SLIDE_PUZZLE_BLANK)}
            boardSize={boardSize}
          />
        )}
        {tiles.map(({ tile, cellIndex }) => (
          <SlidePuzzleTile
            key={tile}
            tile={tile}
            cellIndex={cellIndex}
            boardSize={boardSize}
            disabled={interactionDisabled}
            cue={cues.find((cue) => cue.tile === tile)}
            spotlit={spotlitTiles?.includes(tile) ?? false}
            // 盤面を戻す・別の問題などの置き換えでは、タイル同士が交差して滑らないよう即座に並べ替える。
            slideAnimated={operation !== null}
            faceRef={(element) => {
              if (element) {
                tileFaceRefs.current.set(tile, element);
              } else {
                tileFaceRefs.current.delete(tile);
              }
            }}
            onPress={onSlideTile}
            onSwipe={handleSwipe}
          />
        ))}
        {clearing && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-0 left-0 ${tileSizeClassByBoardSize[boardSize]} p-[1cqw]`}
            style={{
              transform: `translate(${(boardSize - 1) * 100}%, ${(boardSize - 1) * 100}%)`,
            }}
          >
            <SlidePuzzleTileFace
              tile={board.length}
              boardSize={boardSize}
              ref={lastPieceRef}
            />
          </span>
        )}
      </div>
    </div>
  );
}

function animateLastPiece(element: HTMLElement | null): Animation[] {
  const animation = element?.animate?.(clearLastPieceKeyframes, {
    duration: CLEAR_LAST_PIECE_DURATION_MS,
    delay: CLEAR_LAST_PIECE_DELAY_MS,
    easing: CLEAR_LAST_PIECE_EASING,
    fill: "backwards",
  });
  return animation ? [animation] : [];
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
