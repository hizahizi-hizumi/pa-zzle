import { type RefObject, useLayoutEffect, useState } from "react";

import type { TsumeShogiRejection } from "@/games/tsume-shogi/session/session";
import {
  playRejectionShake,
  prefersReducedMotion,
  type RejectionShakeTiming,
} from "@/lib/motion";

const rejectedPieceShakeTiming: RejectionShakeTiming = {
  durationMs: 520,
  easing: "ease-in-out",
};

/**
 * 升の幅に対する揺れ幅。駒が隣の升へかからない最大の振れ幅（升と駒の幅の差の半分ほど）にとどめ、
 * 往復の回数を増やして時間で見えやすさを補う。
 */
const rejectedPieceShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-6%)" },
  { transform: "translateX(6%)" },
  { transform: "translateX(-6%)" },
  { transform: "translateX(6%)" },
  { transform: "translateX(-3%)" },
  { transform: "translateX(0)" },
];

/** 動きを減らす設定で、選んでいた駒の地を変えておく時間。揺れと同じくらいの短さにする。 */
const REJECTED_PIECE_FLASH_MS = 240;

/**
 * 着手させなかった入力を、選んでいた駒で返す。理由は文で示さない。
 * 駒を小さく横に揺らし、動きを減らす設定では揺らさずに、駒の地を短く変える。
 * `container` の中の `selectedPieceSelector` が揺らす駒。戻り値は駒の地を変えている間 `true`。
 */
export function useRejectedPieceFeedback(
  rejection: TsumeShogiRejection | null,
  container: RefObject<Element | null>,
  selectedPieceSelector: string,
): boolean {
  const [flashing, setFlashing] = useState(false);

  useLayoutEffect(() => {
    if (!rejection) return;
    if (!prefersReducedMotion()) {
      playRejectionShake(
        container.current?.querySelector(selectedPieceSelector),
        rejectedPieceShakeKeyframes,
        rejectedPieceShakeTiming,
      );
      return;
    }

    setFlashing(true);
    const timer = window.setTimeout(
      () => setFlashing(false),
      REJECTED_PIECE_FLASH_MS,
    );
    return () => {
      window.clearTimeout(timer);
      setFlashing(false);
    };
  }, [rejection, container, selectedPieceSelector]);

  return flashing;
}
