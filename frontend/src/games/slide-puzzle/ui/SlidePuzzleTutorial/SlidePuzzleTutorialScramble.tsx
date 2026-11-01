import { type ReactNode, useEffect, useState } from "react";

import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { getSlidePuzzleSlide } from "@/games/slide-puzzle/puzzle/rules";
import {
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";
import { slidePuzzleTutorialScrambleBoards } from "@/games/slide-puzzle/tutorial/tutorial";
import { prefersReducedMotion } from "@/lib/motion";

/** 崩していく途中の1コマ。`operation` は、前のコマからこのコマへのスライド。 */
export type SlidePuzzleScrambleFrame = {
  board: SlidePuzzleBoard;
  operation: SlidePuzzleOperation | null;
};

type SlidePuzzleTutorialScrambleProps = {
  /** `true` の間、ゴールの盤面から始めの盤面へ1枚ずつ崩していく。`false` に戻ると最初のコマへ戻る。 */
  active: boolean;
  onComplete: () => void;
  /** 崩している間はそのコマを、それ以外は `null` を受け取って盤面を描く。 */
  children: (frame: SlidePuzzleScrambleFrame | null) => ReactNode;
};

/** 盤面のスライドの動き（`--duration-normal`）が収まってから次の1枚を動かす間隔。 */
const SCRAMBLE_STEP_MS = 260;
/** 最初の1枚を動かすまでと、最後の1枚が収まってから終えるまでの間。 */
const SCRAMBLE_SETTLE_MS = 200;

const frames: readonly SlidePuzzleScrambleFrame[] =
  slidePuzzleTutorialScrambleBoards.map(function createFrame(board, index) {
    const before = slidePuzzleTutorialScrambleBoards[index - 1];
    const slide = before
      ? getSlidePuzzleSlide(before, board.indexOf(SLIDE_PUZZLE_BLANK))
      : null;
    return {
      board,
      operation:
        before && slide
          ? {
              id: index,
              type: "slid",
              slide,
              boardBefore: before,
              boardAfter: board,
              isClearingMove: false,
            }
          : null,
    };
  });

/**
 * 導入で、ゴールの盤面から1枚ずつスライドさせて、始めの盤面まで崩していく。
 * 動きを減らす設定では、崩さずにすぐ終える。
 */
export function SlidePuzzleTutorialScramble({
  active,
  onComplete,
  children,
}: SlidePuzzleTutorialScrambleProps) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (prefersReducedMotion()) {
      onComplete();
      return;
    }

    const lastIndex = frames.length - 1;
    const timers = [
      ...frames
        .slice(1)
        .map((_, index) =>
          window.setTimeout(
            () => setFrameIndex(index + 1),
            SCRAMBLE_SETTLE_MS + index * SCRAMBLE_STEP_MS,
          ),
        ),
      window.setTimeout(
        onComplete,
        SCRAMBLE_SETTLE_MS * 2 + (lastIndex - 1) * SCRAMBLE_STEP_MS,
      ),
    ];
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      setFrameIndex(0);
    };
  }, [active, onComplete]);

  return children(active ? (frames[frameIndex] ?? null) : null);
}
