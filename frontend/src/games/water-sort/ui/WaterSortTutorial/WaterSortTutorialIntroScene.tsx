import { type ReactNode, useEffect, useRef, useState } from "react";

import type { TutorialIntroScene } from "@/components/TutorialOverlay";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

type WaterSortTutorialIntroSceneProps = {
  scene: TutorialIntroScene | null;
  /** `true` の間、場面の動きを見せる。 */
  playing: boolean;
  onSceneEnd: () => void;
  /** 動かさずに見せたゴールの場面を終えたら呼ぶ。 */
  onStillSceneEnd: () => void;
  /** ゴールの盤面を見せるときは `true` を受け取って盤面を描く。 */
  children: (showsGoal: boolean) => ReactNode;
};

/** ゴールの盤面を薄くして消しながら、始めの盤面を浮かび上がらせる間。 */
const CROSS_FADE_MS = 500;

const fadeOutKeyframes: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];
const fadeInKeyframes: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

function canAnimate(): boolean {
  return (
    typeof HTMLElement.prototype.animate === "function" &&
    !prefersReducedMotion()
  );
}

/**
 * 導入で、ゴールの盤面を見せ、始めの盤面へ替える。
 * ゴールの場面は動かさずに見せる。始めの場面では、始まりの一言と同時に、ゴールの盤面を薄くしながら始めの盤面を浮かび上がらせる。
 * 動きを減らす設定では、替えるだけですぐ終える。
 */
export function WaterSortTutorialIntroScene({
  scene,
  playing,
  onSceneEnd,
  onStillSceneEnd,
  children,
}: WaterSortTutorialIntroSceneProps) {
  const startRef = useRef<HTMLDivElement>(null);
  const goalRef = useRef<HTMLDivElement>(null);
  const [crossFadeEnded, setCrossFadeEnded] = useState(false);
  const crossFading =
    scene === "start" && playing && !crossFadeEnded && canAnimate();

  useEffect(() => {
    if (!playing) {
      return;
    }
    if (scene === "goal") {
      onStillSceneEnd();
      return;
    }
    const start = startRef.current;
    const goal = goalRef.current;
    if (scene !== "start" || !start || !goal || !canAnimate()) {
      onSceneEnd();
      return;
    }

    let active = true;
    // 上に重ねたゴールの盤面を、始まりの一言と同じく出だしから薄くし、下の始めの盤面をすぐ見せ始める。
    const timing = {
      duration: CROSS_FADE_MS,
      easing: MOTION_EASING.enter,
      fill: "both",
    } as const;
    const fadeIn = start.animate(fadeInKeyframes, timing);
    const fadeOut = goal.animate(fadeOutKeyframes, timing);
    fadeIn.finished.then(
      function finishScene() {
        if (active) {
          setCrossFadeEnded(true);
          onSceneEnd();
        }
      },
      function ignoreCancelled() {},
    );
    return () => {
      active = false;
      fadeIn.cancel();
      fadeOut.cancel();
      setCrossFadeEnded(false);
    };
  }, [scene, playing, onSceneEnd, onStillSceneEnd]);

  return (
    <div className="relative size-full">
      <div ref={startRef} className="size-full">
        {children(scene === "goal")}
      </div>
      {crossFading && (
        <div
          ref={goalRef}
          aria-hidden="true"
          inert
          className="absolute inset-0"
        >
          {children(true)}
        </div>
      )}
    </div>
  );
}
