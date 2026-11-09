import { useEffect, useLayoutEffect, useRef } from "react";

import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import {
  getSlidePuzzleBoardSize,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard as SlidePuzzleBoardState,
  type SlidePuzzleTile as SlidePuzzleTileNumber,
} from "@/games/slide-puzzle/puzzle/state";
import {
  CLEAR_WAVE_DURATION_MS,
  clearWaveKeyframes,
  getClearWaveTileDelayMs,
} from "@/games/slide-puzzle/ui/board/clear-wave";
import { SlidePuzzleBlankSpotlight } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleBlankSpotlight";
import { SlidePuzzleTile } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleTile";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";
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

const CLEAR_HOLD_MS = 240;

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
  operation,
  interactionDisabled,
  clearing,
  cues = [],
  spotlitTiles = null,
  onSlideTile,
  onClearAnimationComplete,
}: SlidePuzzleBoardProps) {
  const tileFaceRefs = useRef(new Map<number, HTMLSpanElement>());
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
