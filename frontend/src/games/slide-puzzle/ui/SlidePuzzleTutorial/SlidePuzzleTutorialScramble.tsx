import { type ReactNode, useEffect, useState } from "react";

import type { SlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/state";
import { MOTION_DURATION_MS } from "@/lib/motion";

type SlidePuzzleTutorialScrambleProps = {
  /** `true` の間、盤面を1手ずつ崩す。`false` に戻ると崩す途中の盤面を手放す。 */
  active: boolean;
  /** 最初が今見えている盤面、最後が崩し終えた盤面。隣り合う盤面は1回押した違いにする。 */
  boards: readonly SlidePuzzleBoard[];
  onComplete: () => void;
  /** 崩している途中の盤面と、その何番目か。崩していないときは `null`。 */
  children: (frameIndex: number | null) => ReactNode;
};

/**
 * 1手ごとの間。タイルの滑り（`--duration-normal`）が止まってから次のタイルを動かし、
 * 1手ずつ目で追えて、滑っている途中のタイルが重なって見えないようにする。
 */
const SCRAMBLE_STEP_MS = 180;
/** 最後の手から、名前を上部へ移すまでの間。最後のタイルが滑り終えるのを待つ。 */
const SCRAMBLE_SETTLE_MS = MOTION_DURATION_MS.normal;

/** 完成した盤面を、解く手を逆にたどって始めの盤面まで崩す。崩し終えた盤面は、手放すまで保つ。 */
export function SlidePuzzleTutorialScramble({
  active,
  boards,
  onComplete,
  children,
}: SlidePuzzleTutorialScrambleProps) {
  const [frameIndex, setFrameIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    // 最初の盤面は今見えている盤面なので、すぐ1手目を崩す。
    const moveCount = boards.length - 1;
    const timers = [
      ...Array.from({ length: moveCount }, (_, move) =>
        window.setTimeout(
          () => setFrameIndex(move + 1),
          move * SCRAMBLE_STEP_MS,
        ),
      ),
      window.setTimeout(
        onComplete,
        (moveCount - 1) * SCRAMBLE_STEP_MS + SCRAMBLE_SETTLE_MS,
      ),
    ];
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      setFrameIndex(null);
    };
  }, [active, boards, onComplete]);

  return children(active ? frameIndex : null);
}
