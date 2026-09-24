import { useEffect, useLayoutEffect, useRef } from "react";

import type { FifteenPuzzleOperation } from "@/games/fifteen-puzzle/play/use-fifteen-puzzle-play";
import {
  FIFTEEN_PUZZLE_BLANK,
  FIFTEEN_PUZZLE_CELL_COUNT,
  type FifteenPuzzleBoard as FifteenPuzzleBoardState,
} from "@/games/fifteen-puzzle/puzzle/state";
import { FifteenPuzzleTile } from "@/games/fifteen-puzzle/ui/board/FifteenPuzzleBoard/FifteenPuzzleTile";

type FifteenPuzzleBoardProps = {
  board: FifteenPuzzleBoardState;
  operation: FifteenPuzzleOperation | null;
  interactionDisabled: boolean;
  clearing: boolean;
  onSlideTile: (tileIndex: number) => void;
  onClearingComplete: () => void;
};

/** タイルの滑りは `duration-normal` で終わる。完成演出は最後のタイルが収まってから始める。 */
const SLIDE_DURATION_MS = 150;
const CLEAR_WAVE_STAGGER_MS = 32;
const CLEAR_WAVE_DURATION_MS = 360;
const CLEAR_SETTLE_MS = 240;

export function FifteenPuzzleBoard({
  board,
  operation,
  interactionDisabled,
  clearing,
  onSlideTile,
  onClearingComplete,
}: FifteenPuzzleBoardProps) {
  const tileFaceRefs = useRef(new Map<number, HTMLSpanElement>());
  const tiles = board
    .map((tile, cellIndex) => ({ tile, cellIndex }))
    .filter(({ tile }) => tile !== FIFTEEN_PUZZLE_BLANK)
    .sort((left, right) => left.tile - right.tile);

  useLayoutEffect(() => {
    if (operation?.type !== "invalid") {
      return;
    }

    const tile = board[operation.tileIndex];
    animateInvalidTile(
      tile === undefined ? undefined : tileFaceRefs.current.get(tile),
    );
  }, [board, operation]);

  useEffect(() => {
    if (!clearing) {
      return;
    }

    const facesInTileOrder = Array.from(
      { length: FIFTEEN_PUZZLE_CELL_COUNT - 1 },
      (_, index) => tileFaceRefs.current.get(index + 1),
    );
    return animateClear(facesInTileOrder, onClearingComplete);
  }, [clearing, onClearingComplete]);

  return (
    <div
      role="group"
      aria-label="盤面"
      className="@container size-full rounded-xl bg-muted p-[1.5cqw]"
    >
      <div className="relative size-full">
        {tiles.map(({ tile, cellIndex }) => (
          <FifteenPuzzleTile
            key={tile}
            tile={tile}
            cellIndex={cellIndex}
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

function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function animateInvalidTile(element: HTMLElement | undefined) {
  if (!element?.animate || prefersReducedMotion()) {
    return;
  }

  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-5%)" },
      { transform: "translateX(5%)" },
      { transform: "translateX(-2.5%)" },
      { transform: "translateX(0)" },
    ],
    { duration: 220, easing: "ease-out" },
  );
}

/** 1 から順にタイルを小さく持ち上げ、数字が並んだことを確かめる波を送る。 */
function animateClear(
  elements: readonly (HTMLElement | undefined)[],
  onComplete: () => void,
): (() => void) | undefined {
  if (
    prefersReducedMotion() ||
    elements.some((element) => typeof element?.animate !== "function")
  ) {
    onComplete();
    return;
  }

  const animations = elements.map((element, order) =>
    element?.animate(
      [
        { transform: "translateY(0)" },
        {
          transform: "translateY(-6%)",
          boxShadow: "0 6px 12px rgb(0 0 0 / 0.12)",
          offset: 0.4,
        },
        { transform: "translateY(0)" },
      ],
      {
        duration: CLEAR_WAVE_DURATION_MS,
        delay: SLIDE_DURATION_MS + order * CLEAR_WAVE_STAGGER_MS,
        easing: "cubic-bezier(.2,.8,.2,1)",
      },
    ),
  );

  let cancelled = false;
  let settleTimer: number | undefined;
  Promise.all(animations.map((animation) => animation?.finished))
    .then(() => {
      if (!cancelled) {
        settleTimer = window.setTimeout(onComplete, CLEAR_SETTLE_MS);
      }
    })
    .catch(() => {
      // 取り消された演出は完了扱いにしない。
    });

  return () => {
    cancelled = true;
    for (const animation of animations) {
      animation?.cancel();
    }
    if (settleTimer !== undefined) {
      window.clearTimeout(settleTimer);
    }
  };
}
