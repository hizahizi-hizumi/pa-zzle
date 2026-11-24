import { useEffect, useEffectEvent, useLayoutEffect } from "react";

import type { SolitaireOperation } from "@/games/solitaire/play/use-solitaire-play";
import { solitaireSuits } from "@/games/solitaire/puzzle/card";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import type { SolitaireSource } from "@/games/solitaire/puzzle/rules";
import type { SolitaireState } from "@/games/solitaire/puzzle/state";
import type { SolitaireBoardGeometry } from "@/games/solitaire/ui/board/board-geometry";
import {
  getSolitaireBump,
  listSolitaireMoveTravels,
  type SolitaireCardMotionKey,
} from "@/games/solitaire/ui/board/card-motion";
import {
  playAnimations,
  playRejectionShake,
  prefersReducedMotion,
  type RejectionShakeTiming,
} from "@/lib/motion";

/** 札が置き元から置き先へ移る動き。 */
const cardMoveDurationMs = 200;
const cardMoveEasing = "cubic-bezier(0.2, 0.7, 0.3, 1)";

/** 置けない山へ札を向けて戻す動き。`bumpContactOffset` は、札がいちばん進む時点（動きの長さに対する割合）。 */
const bumpDurationMs = 320;
const bumpContactOffset = 0.4;
/** 置けない山が、当たった向きへ押される幅（px）。 */
const bumpTargetNudgePx = 3;

/** 置き元を選んでいないときに、札の無い山などを押したときの揺れ。 */
const invalidPileShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-4px)" },
  { transform: "translateX(4px)" },
  { transform: "translateX(-2px)" },
  { transform: "translateX(0)" },
];
const invalidPileShakeTiming: RejectionShakeTiming = {
  durationMs: 220,
  easing: "ease-out",
};

/** クリアしたとき、最後の札が組札に着いてから、組札をマークの順に1つずつ照らす。 */
const clearGlowKeyframes: Keyframe[] = [
  { transform: "scale(1)", filter: "brightness(1)" },
  { transform: "scale(1.08)", filter: "brightness(1.2)" },
  { transform: "scale(1)", filter: "brightness(1)" },
];
const clearGlowDurationMs = 360;
const clearGlowStaggerMs = 140;
const clearHoldMs = 400;

/** 動いている札を、ほかの山の札より手前に描く。 */
const travelingZIndex = 1;

type SolitaireBoardMotionOptions = {
  state: SolitaireState;
  selectedSource: SolitaireSource | null;
  operation: SolitaireOperation | null;
  geometry: SolitaireBoardGeometry;
  /** 列の枚数から盤面の寸法を求める。手を打つ前の札の位置に使う。 */
  getGeometry: (columnLengths: readonly number[]) => SolitaireBoardGeometry;
  getCardElement: (key: SolitaireCardMotionKey) => HTMLElement | undefined;
  getPileElement: (pile: SolitairePile) => HTMLElement | undefined;
  /** 置き元に選んだ札を囲む枠。札と一緒に向けて戻す。 */
  getSelectionFrameElement: () => HTMLElement | undefined;
  onClearAnimationComplete?: () => void;
};

function animateElement(
  element: HTMLElement | undefined,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation[] {
  return typeof element?.animate === "function"
    ? [element.animate(keyframes, options)]
    : [];
}

/**
 * 盤面の動き。手を打つと札を置き元から置き先へ移し、置けない山を押すと選んだ札をその山へ向けて戻す。
 * クリアの手では、札が組札に着いてから組札を順に照らし、照らし終えたら `onClearAnimationComplete` で知らせる。
 * 動きを減らす設定では、札を移さず、向けて戻さず、揺らさない。
 */
export function useSolitaireBoardMotion({
  state,
  selectedSource,
  operation,
  geometry,
  getGeometry,
  getCardElement,
  getPileElement,
  getSelectionFrameElement,
  onClearAnimationComplete,
}: SolitaireBoardMotionOptions) {
  const playOperationMotion = useEffectEvent(function playOperationMotion(
    current: SolitaireOperation,
  ): Animation[] {
    if (current.type === "invalid") {
      if (selectedSource === null) {
        playRejectionShake(
          getPileElement(current.pile),
          invalidPileShakeKeyframes,
          invalidPileShakeTiming,
        );
        return [];
      }
      if (prefersReducedMotion() || geometry.cardWidth === 0) {
        return [];
      }
      const bump = getSolitaireBump(
        { state, geometry },
        selectedSource,
        current.pile,
      );
      if (bump === null) {
        return [];
      }
      const contact = `translate(${bump.dx}px, ${bump.dy}px)`;
      const distance = Math.hypot(bump.dx, bump.dy);
      const nudge = `translate(${(bump.dx / distance) * bumpTargetNudgePx}px, ${(bump.dy / distance) * bumpTargetNudgePx}px)`;
      const bumpKeyframes: Keyframe[] = [
        { transform: "translate(0, 0)", zIndex: travelingZIndex },
        {
          offset: bumpContactOffset,
          transform: contact,
          zIndex: travelingZIndex,
          easing: "ease-in-out",
        },
        { transform: "translate(0, 0)", zIndex: travelingZIndex },
      ];
      return [
        ...[
          ...bump.keys.map((key) => getCardElement(key)),
          getSelectionFrameElement(),
        ].flatMap((element) =>
          animateElement(element, bumpKeyframes, {
            duration: bumpDurationMs,
            easing: "ease-out",
          }),
        ),
        ...animateElement(
          getPileElement(current.pile),
          [
            { transform: "translate(0, 0)" },
            { offset: bumpContactOffset, transform: "translate(0, 0)" },
            { offset: bumpContactOffset + 0.15, transform: nudge },
            { transform: "translate(0, 0)" },
          ],
          { duration: bumpDurationMs, easing: "ease-out" },
        ),
      ];
    }
    // 盤面の大きさを測る前（再読み込みで直前の手を読み戻したときなど）は、札の位置が決まらないので動かさない。
    if (
      current.type !== "moved" ||
      prefersReducedMotion() ||
      geometry.cardWidth === 0
    ) {
      return [];
    }
    const before = {
      state: current.stateBefore,
      geometry: getGeometry(
        current.stateBefore.columns.map((column) => column.length),
      ),
    };
    return listSolitaireMoveTravels(current.move, before, {
      state,
      geometry,
    }).flatMap(({ key, from, to }) =>
      animateElement(
        getCardElement(key),
        [
          {
            transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`,
            zIndex: travelingZIndex,
          },
          { transform: "translate(0, 0)", zIndex: travelingZIndex },
        ],
        { duration: cardMoveDurationMs, easing: cardMoveEasing },
      ),
    );
  });

  useLayoutEffect(() => {
    if (operation === null) {
      return;
    }
    const animations = playOperationMotion(operation);
    return () => {
      for (const animation of animations) {
        animation.finish();
      }
    };
  }, [operation]);

  const clearingOperationId =
    operation?.type === "moved" && operation.isClearingMove
      ? operation.id
      : null;
  const finishClearAnimation = useEffectEvent(function finishClearAnimation() {
    onClearAnimationComplete?.();
  });
  const animateClearGlow = useEffectEvent(function animateClearGlow() {
    return solitaireSuits.flatMap((suit, index) =>
      animateElement(
        getPileElement({ pile: "foundation", suit }),
        clearGlowKeyframes,
        {
          duration: clearGlowDurationMs,
          delay: cardMoveDurationMs + index * clearGlowStaggerMs,
          easing: "ease-out",
        },
      ),
    );
  });
  useEffect(() => {
    if (clearingOperationId === null) {
      return;
    }
    return playAnimations({
      animate: animateClearGlow,
      completion: { type: "after-animations", holdMs: clearHoldMs },
      reducedMotionHoldMs: clearHoldMs,
      unanimatedHoldMs: clearHoldMs,
      onFinished: finishClearAnimation,
    });
  }, [clearingOperationId]);
}
