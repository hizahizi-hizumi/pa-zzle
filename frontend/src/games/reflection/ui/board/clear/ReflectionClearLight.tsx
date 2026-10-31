import { useEffect, useMemo, useRef } from "react";

import type { ReflectionBoard } from "@/games/reflection/puzzle/board";
import { listDistinctReflectionLaserTraces } from "@/games/reflection/ui/board/board-geometry";
import { ReflectionLaserPath } from "@/games/reflection/ui/board/ReflectionLaserPath";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

type ReflectionClearLightProps = {
  board: ReflectionBoard;
  /** `true` の間に一度だけ、光路を伸ばす演出を再生する。 */
  active: boolean;
  onComplete: () => void;
};

const stepSelector = "[data-clear-light-step]";

/** 全光路を伸ばし切るまでの時間。光路の本数によらず同じ長さにする。 */
const CLEAR_LIGHT_SPREAD_MS = 640;
const CLEAR_LIGHT_DRAW_MS = 420;
/**
 * 全光路が点いた盤面を、結果画面へ切り替える前に見せておく時間。
 * 揃った光路の形がこのゲームの報酬なので、伸ばし終えた後や動きを減らす設定でも、静止した全光路を読める間を残す。
 */
const CLEAR_LIGHT_HOLD_MS = 700;
/** 演出を始めてから結果へ進めるまでの時間。光路の本数によらず、全光路を伸ばし切る時間に見せておく時間を足した長さにする。 */
const CLEAR_LIGHT_TOTAL_MS =
  CLEAR_LIGHT_SPREAD_MS + CLEAR_LIGHT_DRAW_MS + CLEAR_LIGHT_HOLD_MS;

const lineKeyframes: Keyframe[] = [
  { strokeDashoffset: 1 },
  { strokeDashoffset: 0 },
];
const arrowKeyframes: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

function getStep(element: Element): number {
  return Number((element as HTMLElement).dataset.clearLightStep ?? 0);
}

/**
 * 揃った盤面の全光路を、外周ヒントの並び順（上・右・下・左）に少しずつずらして入口から伸ばし、結果へ進める。
 * 光路はピースの下に描くので、ピースの形は隠さない。動きを減らす設定では伸ばさずに全光路を出し、同じ間だけ見せてから結果へ進める。
 */
export function ReflectionClearLight({
  board,
  active,
  onComplete,
}: ReflectionClearLightProps) {
  const groupRef = useRef<SVGGElement>(null);
  const traces = useMemo(
    () => listDistinctReflectionLaserTraces(board),
    [board],
  );

  useEffect(() => {
    if (!active) return;

    return playAnimations({
      animate() {
        const steps = Array.from(
          groupRef.current?.querySelectorAll(stepSelector) ?? [],
        );
        const lastStep = Math.max(0, ...steps.map(getStep));
        const staggerMs = lastStep > 0 ? CLEAR_LIGHT_SPREAD_MS / lastStep : 0;
        return steps.flatMap(function animateStep(element) {
          const delay = getStep(element) * staggerMs;
          const line = element.querySelector("[data-laser-line]");
          const arrow = element.querySelector("[data-laser-arrow]");
          return [
            line?.animate?.(lineKeyframes, {
              duration: CLEAR_LIGHT_DRAW_MS,
              delay,
              easing: MOTION_EASING.celebrate,
              fill: "backwards",
            }),
            arrow?.animate?.(arrowKeyframes, {
              duration: CLEAR_LIGHT_DRAW_MS / 2,
              delay: delay + CLEAR_LIGHT_DRAW_MS / 2,
              fill: "backwards",
            }),
          ].filter((animation) => animation !== undefined);
        });
      },
      completion: { type: "after-duration", durationMs: CLEAR_LIGHT_TOTAL_MS },
      reducedMotionHoldMs: CLEAR_LIGHT_HOLD_MS,
      unanimatedHoldMs: 0,
      onFinished: onComplete,
    });
  }, [active, onComplete]);

  return (
    <g ref={groupRef} strokeDasharray="1 1">
      {traces.map(({ entry, trace }, step) => (
        <ReflectionLaserPath
          key={`${entry.side}:${entry.index}`}
          size={board.size}
          entry={entry}
          trace={trace}
          clearStep={step}
        />
      ))}
    </g>
  );
}
