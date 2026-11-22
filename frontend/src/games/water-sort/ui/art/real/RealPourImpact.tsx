import { useRef } from "react";
import { getDestinationFill } from "@/games/water-sort/ui/board/pour/destination-fill";
import type { PourImpactProps } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/PourImpact/LabPourImpact";
import {
  getLiquidBox,
  getStreamX,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/stream-geometry";
import {
  getFlowRate,
  POUR_FALL_MS,
} from "@/games/water-sort/ui/board/pour/pour-timing";
import { useAnimationFrame } from "@/games/water-sort/ui/board/pour/use-animation-frame";

const BUBBLE_IDS = [0, 1, 2, 3] as const;
/** 泡1つが、流れに押し込まれてから液面へ戻るまでの長さと、泡どうしの生まれる間。 */
const BUBBLE_LIFE_MS = 380;
const BUBBLE_SPAWN_GAP_MS = 95;
/** 泡を出すのに要る液の深さ（段）。浅いと泡が底に当たる。 */
const BUBBLE_MIN_DEPTH_SLOTS = 0.3;
/** 流れが止んでから、液面の乱れが静まるまで。 */
const RIPPLE_FADE_MS = 90;
/** 空の試験管の底に当たった液が、底いっぱいに広がるまで。 */
const SPREAD_MS = 200;
/** 同じ試薬に当たった所が明るむ長さ。 */
const MERGE_GLOW_MS = 420;

/** 泡の大きさ・深さ・横のずれを決める、注ぎと泡ごとに決まった乱数（0〜1）。 */
function getNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 流れが当たった所の乱れ。液面が細かく波立って窓の光をはね返し、流れに押し込まれた空気の泡が液面へ戻る。
 * 泡は、光の来る左上につやが立ち、縁が光を曲げて暗い。空の試験管では、底に当たった液が底いっぱいに広がる。
 * 同じ試薬の上に注ぐと、当たった所で液が混ざり合って光がゆらぎ、それまでの液と溶け合う。
 */
export function RealPourImpact({
  animation,
  animations,
  clocks,
}: PourImpactProps) {
  const rippleRef = useRef<HTMLSpanElement>(null);
  const spreadRef = useRef<HTMLSpanElement>(null);
  const mergeGlowRef = useRef<HTMLSpanElement>(null);
  const bubbleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const { timing, destination } = animation;
  const box = getLiquidBox(destination.rect);
  const streamLeft = getStreamX(animation) - box.left;
  const streamWidth = Math.max(2, destination.rect.width * 0.085);
  const landsOnEmpty = destination.before.length === 0;
  const mergesWithSame =
    destination.before[destination.before.length - 1] === animation.colorIndex;

  useAnimationFrame(function drawPourImpact() {
    const fill = getDestinationFill(animations, clocks.getElapsedMs);
    if (!fill) {
      return;
    }
    const elapsedMs = clocks.getElapsedMs(animation.id);
    const sinceLanding = elapsedMs - timing.landStartMs;
    const surfaceBottom = fill.surfaceSlots * box.slotHeight;
    const landingProgress =
      (elapsedMs - POUR_FALL_MS - timing.touchMs) /
      (timing.flowEndMs - timing.touchMs);
    const afterLanding = elapsedMs - timing.landEndMs;
    const intensity =
      sinceLanding < 0
        ? 0
        : afterLanding < 0
          ? 0.35 + 0.65 * getFlowRate(Math.min(landingProgress, 0.999))
          : 1 - clamp01(afterLanding / RIPPLE_FADE_MS);

    const ripple = rippleRef.current;
    if (ripple) {
      const pulse = 1 + 0.18 * Math.sin(elapsedMs / 31);
      ripple.style.bottom = `${surfaceBottom}px`;
      ripple.style.opacity = String(0.85 * intensity);
      ripple.style.transform = `translate(-50%, 50%) scaleX(${pulse})`;
    }

    bubbleRefs.current.forEach((bubble, index) => {
      if (!bubble) {
        return;
      }
      const sinceSpawn = sinceLanding - index * BUBBLE_SPAWN_GAP_MS;
      const cycle = Math.floor(sinceSpawn / BUBBLE_LIFE_MS);
      const age = sinceSpawn - cycle * BUBBLE_LIFE_MS;
      const spawnedAt = timing.landStartMs + sinceSpawn - age;
      if (
        sinceSpawn < 0 ||
        spawnedAt > timing.landEndMs ||
        fill.surfaceSlots < BUBBLE_MIN_DEPTH_SLOTS
      ) {
        bubble.style.opacity = "0";
        return;
      }
      const seed = animation.id * 31 + index * 7 + cycle * 13;
      const progress = age / BUBBLE_LIFE_MS;
      const maxDepth = Math.min(
        surfaceBottom - 2,
        box.slotHeight * (0.25 + 0.4 * getNoise(seed)),
      );
      const depth = maxDepth * Math.sin(Math.PI * progress);
      const drift = (getNoise(seed + 1) - 0.5) * streamWidth * 3 * progress;
      bubble.style.left = `${streamLeft + drift}px`;
      bubble.style.bottom = `${surfaceBottom - depth}px`;
      bubble.style.opacity = String(
        0.85 * Math.min(1, progress / 0.08) * (1 - progress) ** 0.6,
      );
      bubble.style.transform = `translate(-50%, 50%) scale(${0.6 + 0.6 * getNoise(seed + 2)})`;
    });

    const spread = spreadRef.current;
    if (spread) {
      const progress = clamp01(sinceLanding / SPREAD_MS);
      spread.style.opacity = String(
        sinceLanding < 0 ? 0 : 0.7 * (1 - progress),
      );
      spread.style.width = `${streamWidth + (box.width * 1.1 - streamWidth) * (1 - (1 - progress) ** 2)}px`;
    }

    const mergeGlow = mergeGlowRef.current;
    if (mergeGlow) {
      const progress = clamp01(sinceLanding / MERGE_GLOW_MS);
      mergeGlow.style.opacity = String(
        sinceLanding < 0
          ? 0
          : Math.min(1, progress / 0.12) * (1 - progress) ** 1.5,
      );
    }
  });

  return (
    <>
      {mergesWithSame && (
        <span
          ref={mergeGlowRef}
          className="absolute h-[60%] w-[160%] -translate-x-1/2 translate-y-1/2 opacity-0"
          style={{
            left: `${streamLeft}px`,
            bottom: `${destination.before.length * 25}%`,
            maxHeight: `${box.slotHeight * 1.2}px`,
            backgroundImage:
              "radial-gradient(closest-side, rgba(255,255,255,0.3), rgba(255,255,255,0.18) 40%, rgba(20,30,35,0.08) 62%, rgba(255,255,255,0.1) 78%, transparent)",
          }}
        />
      )}
      {landsOnEmpty && (
        <span
          ref={spreadRef}
          className="absolute bottom-0 h-[5px] -translate-x-1/2 rounded-[50%] opacity-0"
          style={{
            left: `${streamLeft}px`,
            backgroundImage:
              "radial-gradient(closest-side, rgba(255,255,255,0.75), rgba(255,255,255,0.2) 60%, transparent)",
          }}
        />
      )}
      {BUBBLE_IDS.map((bubbleId) => (
        <span
          key={bubbleId}
          ref={(element) => {
            bubbleRefs.current[bubbleId] = element;
          }}
          className="absolute size-[3.5px] rounded-full opacity-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 34% 30%, rgba(255,255,255,0.95) 0 16%, rgba(255,255,255,0.22) 34%, rgba(255,255,255,0.06) 58%, rgba(20,30,35,0.5) 82%, transparent 100%)",
          }}
        />
      ))}
      <span
        ref={rippleRef}
        className="absolute h-[3px] rounded-[50%] opacity-0"
        style={{
          left: `${streamLeft}px`,
          width: `${streamWidth * 3.4}px`,
          backgroundImage:
            "radial-gradient(closest-side, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0.8) 42%, rgba(20,30,35,0.22) 64%, rgba(255,255,255,0.35) 80%, transparent)",
        }}
      />
    </>
  );
}
