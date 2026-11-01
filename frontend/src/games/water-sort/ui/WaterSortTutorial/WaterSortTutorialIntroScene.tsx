import { type ReactNode, useEffect, useRef, useState } from "react";

import type { TutorialIntroScene } from "@/components/TutorialOverlay";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

type WaterSortTutorialIntroSceneProps = {
  scene: TutorialIntroScene | null;
  /** `true` の間、場面の動きを見せる。 */
  playing: boolean;
  onSceneEnd: () => void;
  /** ゴールの盤面を見せるときは `true` を受け取って盤面を描く。 */
  children: (showsGoal: boolean) => ReactNode;
};

/** ゴールの盤面を薄くして消し、始めの盤面に替えて浮かび上がらせる間。 */
const FADE_OUT_MS = 300;
const FADE_IN_MS = 400;

const fadeOutKeyframes: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];
const fadeInKeyframes: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

/**
 * 導入で、ゴールの盤面を見せ、始めの盤面へ替える。
 * ゴールの場面は動かさずに見せる。始めの場面では、ゴールの盤面を消してから始めの盤面を浮かび上がらせる。
 * 動きを減らす設定では、替えるだけですぐ終える。
 */
export function WaterSortTutorialIntroScene({
  scene,
  playing,
  onSceneEnd,
  children,
}: WaterSortTutorialIntroSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [goalFaded, setGoalFaded] = useState(false);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const container = containerRef.current;
    if (
      scene !== "start" ||
      !container ||
      typeof container.animate !== "function" ||
      prefersReducedMotion()
    ) {
      onSceneEnd();
      return;
    }

    let active = true;
    const fadeOut = container.animate(fadeOutKeyframes, {
      duration: FADE_OUT_MS,
      easing: MOTION_EASING.exit,
      fill: "forwards",
    });
    let fadeIn: Animation | null = null;
    fadeOut.finished.then(
      function showStart() {
        if (!active) {
          return;
        }
        setGoalFaded(true);
        fadeIn = container.animate(fadeInKeyframes, {
          duration: FADE_IN_MS,
          easing: MOTION_EASING.enter,
          fill: "both",
        });
        fadeOut.cancel();
        fadeIn.finished.then(
          function finishScene() {
            if (active) {
              onSceneEnd();
            }
          },
          function ignoreCancelled() {},
        );
      },
      function ignoreCancelled() {},
    );
    return () => {
      active = false;
      fadeOut.cancel();
      fadeIn?.cancel();
      setGoalFaded(false);
    };
  }, [scene, playing, onSceneEnd]);

  const showsGoal =
    scene === "goal" || (scene === "start" && playing && !goalFaded);
  return (
    <div ref={containerRef} className="size-full">
      {children(showsGoal)}
    </div>
  );
}
