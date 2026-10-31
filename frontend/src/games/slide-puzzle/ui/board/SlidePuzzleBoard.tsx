import { useEffect, useLayoutEffect, useRef } from "react";

import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import {
  getSlidePuzzleBoardSize,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard as SlidePuzzleBoardState,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTile } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard/SlidePuzzleTile";
import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  playAnimations,
  playRejectionShake,
  type RejectionShakeTiming,
} from "@/lib/motion";

export type SlidePuzzleTileHint = { cellIndex: number; id: number };

/**
 * タイルの現れ方。
 * - `concealed`: タイルを伏せ、空の盤面だけを見せる。
 * - `settling`: タイルを番号の順に、それぞれの場所へ降ろす。
 */
export type SlidePuzzleTileEntrance = "concealed" | "settling";

type SlidePuzzleBoardProps = {
  board: SlidePuzzleBoardState;
  operation: SlidePuzzleOperation | null;
  interactionDisabled: boolean;
  clearing: boolean;
  /** 押すタイルを控えめに示す印。`id` が変わると、同じタイルでも印を付け直す。 */
  hint?: SlidePuzzleTileHint | null;
  /** タイルの現れ方。`null` なら、そのまま見せる。 */
  tileEntrance?: SlidePuzzleTileEntrance | null;
  /** タイルを降ろし終えたとき。 */
  onTileEntranceComplete?: () => void;
  onSlideTile: (tileIndex: number) => void;
  onClearAnimationComplete: () => void;
};

/** タイルの滑りは `--duration-normal` で終わる。完成演出は最後のタイルが収まってから始める。 */
const SLIDE_DURATION_MS = MOTION_DURATION_MS.normal;
const CLEAR_WAVE_STAGGER_MS = 32;
const CLEAR_WAVE_DURATION_MS = 360;
const CLEAR_HOLD_MS = 240;
/** タイルを降ろす間。完成の波と同じく番号順に送り、どの番号がどこに入るかを順に見せる。 */
const SETTLE_STAGGER_MS = CLEAR_WAVE_STAGGER_MS;
const SETTLE_DURATION_MS = 220;
const SETTLE_HOLD_MS = 60;

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

const clearWaveKeyframes: Keyframe[] = [
  { transform: "translateY(0)" },
  {
    transform: "translateY(-6%)",
    boxShadow: "0 6px 12px rgb(0 0 0 / 0.12)",
    offset: 0.4,
  },
  { transform: "translateY(0)" },
];

const settleKeyframes: Keyframe[] = [
  { opacity: 0, transform: "translateY(-12%)" },
  { opacity: 1, transform: "translateY(0)" },
];

function noop(): void {}

export function SlidePuzzleBoard({
  board,
  operation,
  interactionDisabled,
  clearing,
  hint = null,
  tileEntrance = null,
  onTileEntranceComplete = noop,
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

  // 伏せていたタイルを見せる描画と同じ時点で動きを付け、伏せを外した姿が一瞬見えないようにする。
  useLayoutEffect(() => {
    if (tileEntrance !== "settling") {
      return;
    }

    const facesInTileOrder = Array.from({ length: tileCount }, (_, index) =>
      tileFaceRefs.current.get(index + 1),
    );
    return playAnimations({
      animate: () => animateSettle(facesInTileOrder),
      completion: { type: "after-animations", holdMs: SETTLE_HOLD_MS },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onTileEntranceComplete,
    });
  }, [tileEntrance, onTileEntranceComplete, tileCount]);

  return (
    <div
      role="group"
      aria-label="盤面"
      className="@container size-full rounded-xl bg-muted p-[1%]"
    >
      <div className="relative size-full">
        {tiles.map(({ tile, cellIndex }) => (
          <SlidePuzzleTile
            key={tile}
            tile={tile}
            cellIndex={cellIndex}
            boardSize={boardSize}
            disabled={interactionDisabled}
            hintId={hint?.cellIndex === cellIndex ? hint.id : null}
            concealed={tileEntrance === "concealed"}
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

/** 番号の順に、タイルを少し上から場所へ降ろす。 */
function animateSettle(
  elements: readonly (HTMLElement | undefined)[],
): Animation[] {
  return elements.flatMap(
    (element, order) =>
      element?.animate?.(settleKeyframes, {
        duration: SETTLE_DURATION_MS,
        delay: order * SETTLE_STAGGER_MS,
        easing: MOTION_EASING.enter,
        fill: "backwards",
      }) ?? [],
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
        delay: SLIDE_DURATION_MS + order * CLEAR_WAVE_STAGGER_MS,
        easing: MOTION_EASING.celebrate,
      }) ?? [],
  );
}
