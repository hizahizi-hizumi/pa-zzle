import { type RefObject, useLayoutEffect, useState } from "react";

import type { TsumeShogiRejection } from "@/games/tsume-shogi/session/session";
import { playRejectionShake, type RejectionShakeTiming } from "@/lib/motion";

const rejectedPieceShakeTiming: RejectionShakeTiming = {
  durationMs: 440,
  easing: "ease-in-out",
};

/**
 * 駒の幅に対する揺れ幅。王手にならない手を拒んだことが、指先の下でもはっきり見える大きさにする。
 * 駒は隣の升へ少しかかるが、揺れは短く、升の地も同時に変えるので、どの駒を拒んだかは紛れない。
 */
const rejectedPieceShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-22%) rotate(-7deg)" },
  { transform: "translateX(20%) rotate(6deg)" },
  { transform: "translateX(-14%) rotate(-4deg)" },
  { transform: "translateX(9%) rotate(2deg)" },
  { transform: "translateX(-4%)" },
  { transform: "translateX(0)" },
];

/** 拒んだ間、選んでいた駒の地を変えておく時間。揺れとほぼ同じ長さにする。動きを減らす設定でも同じに変える。 */
const REJECTED_PIECE_FLASH_MS = 420;

/**
 * `container` の中の `selectedPieceSelector` が揺らす駒。戻り値は駒の地を変えている間 `true`。
 * 動きを減らす設定では揺らさず、地だけを変える。
 */
export function useRejectedPieceFeedback(
  rejection: TsumeShogiRejection | null,
  container: RefObject<Element | null>,
  selectedPieceSelector: string,
): boolean {
  const [flashing, setFlashing] = useState(false);

  useLayoutEffect(() => {
    if (!rejection) return;
    playRejectionShake(
      container.current?.querySelector(selectedPieceSelector),
      rejectedPieceShakeKeyframes,
      rejectedPieceShakeTiming,
    );

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
