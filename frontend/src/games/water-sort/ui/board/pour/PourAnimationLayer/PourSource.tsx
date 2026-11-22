import { useEffect, useRef, useState } from "react";

import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
  type PourClocks,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { TiltedLiquid } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourSource/TiltedLiquid";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import {
  getSourcePose,
  type PourPath,
} from "@/games/water-sort/ui/board/pour/pour-path";
import { useAnimationFrame } from "@/games/water-sort/ui/board/pour/use-animation-frame";
import { TestTube } from "@/games/water-sort/ui/board/test-tube/TestTube";
import { playAnimations } from "@/lib/motion";

type PourSourceProps = {
  animation: PourAnimation;
  clocks: PourClocks;
  onFinish: (animationId: number) => void;
};

/**
 * 注ぐ動きの時計にする Web Animation の動き。見た目を変えない。
 * 試験管の姿は、傾けた液の形と同じフレームで描くよう、この時計の時刻から毎フレーム求めて当てる。
 * 試験管だけを compositor で動かすと、描き直しが遅れた間に液の形と試験管の傾きがずれる。
 */
const CLOCK_KEYFRAMES: Keyframe[] = [{ opacity: 1 }, { opacity: 1 }];

function toTransform(path: PourPath, elapsedMs: number): string {
  const { x, y, tiltDeg } = getSourcePose(path, elapsedMs);
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${tiltDeg.toFixed(2)}deg)`;
}

/** 注ぎ元。試験管ばさみで持ったまま注ぎ先の口へ運び、液面を水平に保ったまま傾けて注ぎ、起こして戻す。 */
export function PourSource({ animation, clocks, onFinish }: PourSourceProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const [clampReleased, setClampReleased] = useState(false);
  const { path } = animation;

  useAnimationFrame(function drawSource() {
    const elapsedMs = clocks.getElapsedMs(animation.id);
    if (sourceRef.current) {
      sourceRef.current.style.transform = toTransform(path, elapsedMs);
    }
    const released = elapsedMs >= animation.timing.clampReleaseMs;
    if (released !== clampReleased) {
      setClampReleased(released);
    }
  });

  useEffect(() => {
    const sourceElement = sourceRef.current;
    if (!sourceElement?.animate) {
      onFinish(animation.id);
      return;
    }

    const cancel = playAnimations({
      animate() {
        const sourceAnimation = sourceElement.animate(CLOCK_KEYFRAMES, {
          duration: animation.timing.durationMs,
        });
        clocks.start(animation.id, sourceAnimation);
        return [sourceAnimation];
      },
      completion: { type: "after-animations", holdMs: 0 },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished() {
        onFinish(animation.id);
      },
    });

    return () => {
      cancel();
      clocks.stop(animation.id);
    };
  }, [onFinish, animation, clocks]);

  return (
    <div
      ref={sourceRef}
      aria-hidden="true"
      className="pointer-events-none fixed origin-top will-change-transform"
      style={{
        ...getOverlayStyle(animation.source.rect, POUR_LAYER_ORDER.source),
        transform: toTransform(path, 0),
      }}
    >
      <TestTube
        contents={[]}
        // 傾けたときに柄が上を向くよう、傾ける向きと逆の側に柄を出す。
        heldBy={
          clampReleased ? undefined : path.direction > 0 ? "left" : "right"
        }
        liquidOverlay={
          <TiltedLiquid
            contents={animation.source.before}
            path={path}
            getElapsedMs={() => clocks.getElapsedMs(animation.id)}
          />
        }
      />
    </div>
  );
}
