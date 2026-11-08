import { useEffect, useLayoutEffect, useRef } from "react";
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
import type { SlidePuzzleSurface } from "@/games/slide-puzzle/ui/board/slide-puzzle-surface";
import {
  MOTION_EASING,
  playAnimations,
  playRejectionShake,
  type RejectionShakeTiming,
} from "@/lib/motion";

type SlidePuzzleBoardProps = {
  board: SlidePuzzleBoardState;
  surface?: SlidePuzzleSurface;
  gestureEnabled?: boolean;
  operation: SlidePuzzleOperation | null;
  interactionDisabled: boolean;
  clearing: boolean;
  onSlideTile: (tileIndex: number) => void;
  onClearAnimationComplete: () => void;
};

const tileSizeClassByBoardSize = {
  3: "size-1/3",
  4: "size-1/4",
  5: "size-1/5",
} as const;

const CLEAR_HOLD_MS = 240;

const boardSurfaceClasses: Record<SlidePuzzleSurface, string> = {
  original: "rounded-[1rem] bg-muted p-[1%]",
  crafted:
    "rounded-[3.5cqw] border border-[#805333] bg-[linear-gradient(135deg,#ad8057_0%,#805132_100%)] p-[1.8%] shadow-[inset_0_4px_12px_#3e1e0d78,0_9px_24px_#3e1e0d35]",
  precision:
    "rounded-[1.3cqw] border border-[#57677a] bg-[linear-gradient(135deg,#4c6273_0%,#2e4052_100%)] p-[1.5%] shadow-[inset_0_5px_12px_#122332a8,0_8px_22px_#162e4130]",
  playful:
    "rounded-[4cqw] bg-[#efe7d7] p-[1.8%] shadow-[0_6px_0_#d7c9b2,0_13px_25px_#53493224]",
};

const emptySlotClasses: Record<
  Exclude<SlidePuzzleSurface, "original">,
  string
> = {
  crafted:
    "rounded-[1.6cqw] border border-[#614022]/60 bg-[#674124]/35 shadow-[inset_0_3px_8px_#31180e70] after:absolute after:inset-[10%] after:rounded-[1cqw] after:border after:border-[#e8c39a]/15",
  precision:
    "rounded-[0.8cqw] border border-[#1c3247]/60 bg-[#1c3143]/65 shadow-[inset_0_3px_9px_#081827bd] after:absolute after:inset-[10%] after:rounded-[0.3cqw] after:border after:border-[#cadbe8]/15",
  playful:
    "rounded-[2.7cqw] border-2 border-dashed border-[#b8ad97]/75 bg-[#e0d7c5]/60",
};

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

export function SlidePuzzleBoard({
  board,
  surface = "original",
  gestureEnabled = false,
  operation,
  interactionDisabled,
  clearing,
  onSlideTile,
  onClearAnimationComplete,
}: SlidePuzzleBoardProps) {
  const tileFaceRefs = useRef(new Map<number, HTMLSpanElement>());
  const boardSize = getSlidePuzzleBoardSize(board);
  const blankIndex = findSlidePuzzleBlankIndex(board);
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

  return (
    <div
      role="group"
      aria-label="盤面"
      className={`@container size-full ${boardSurfaceClasses[surface]}`}
    >
      <div className="relative size-full">
        {surface !== "original" && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-0 left-0 ${tileSizeClassByBoardSize[boardSize]} p-[1cqw]`}
            style={{
              transform: `translate(${getSlidePuzzleColumn(blankIndex, boardSize) * 100}%, ${getSlidePuzzleRow(blankIndex, boardSize) * 100}%)`,
            }}
          >
            <span
              className={`relative block size-full ${emptySlotClasses[surface]}`}
            />
          </div>
        )}
        {tiles.map(({ tile, cellIndex }) => (
          <SlidePuzzleTile
            key={tile}
            tile={tile}
            cellIndex={cellIndex}
            surface={surface}
            boardSize={boardSize}
            moveDirection={
              getSlidePuzzleSlide(board, cellIndex)?.direction ?? null
            }
            gestureEnabled={gestureEnabled}
            disabled={interactionDisabled}
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
          />
        ))}
      </div>
    </div>
  );
}

/** 1 から順にタイルを小さく持ち上げ、数字が並んだことを確かめる波を送る。 */
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
