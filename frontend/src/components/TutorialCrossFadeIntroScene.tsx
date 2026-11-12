import { type ReactNode, useEffect, useRef, useState } from "react";

import type { TutorialIntroScene } from "@/components/TutorialOverlay";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

type TutorialCrossFadeIntroSceneProps = {
  scene: TutorialIntroScene | null;
  playing: boolean;
  onSceneEnd: () => void;
  children: (showsGoal: boolean) => ReactNode;
};

const CROSS_FADE_MS = 500;

const fadeOutKeyframes: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];
const fadeInKeyframes: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

function canAnimate(): boolean {
  return (
    typeof HTMLElement.prototype.animate === "function" &&
    !prefersReducedMotion()
  );
}

/** 盤面の動きで場面を見せないゲームが、`TutorialBoardIntro`・`TutorialStageBoardIntro` を受けて盤面を包むのに使う。 */
export function TutorialCrossFadeIntroScene({
  scene,
  playing,
  onSceneEnd,
  children,
}: TutorialCrossFadeIntroSceneProps) {
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
      onSceneEnd();
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
    // 2つの盤面の濃さは足して常に1になるよう、同じ間と緩急で替える。
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
  }, [scene, playing, onSceneEnd]);

  // 薄くした2つの盤面を重ねるだけでは、両方に同じく描くところも後ろが透けて一瞬白っぽくなる。
  // 替える間はゴールの盤面を濃さを足し合わせて重ね、その重なりを周りから切り離して、同じところは同じ濃さのまま保つ。
  return (
    <div className={`relative size-full ${crossFading ? "isolate" : ""}`}>
      <div ref={startRef} className="size-full">
        {children(scene === "goal")}
      </div>
      {crossFading && (
        <div
          ref={goalRef}
          aria-hidden="true"
          inert
          className="absolute inset-0 mix-blend-plus-lighter"
        >
          {children(true)}
        </div>
      )}
    </div>
  );
}
