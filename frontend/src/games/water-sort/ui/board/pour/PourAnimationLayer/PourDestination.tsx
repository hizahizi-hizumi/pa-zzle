import { useRef } from "react";

import { isCompleteWaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  getOverlayStyle,
  POUR_LAYER_ORDER,
  type PourClocks,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { IncomingLiquid } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/IncomingLiquid";
import { PourImpact } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/PourImpact";
import { PourStream } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/PourStream";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import type { PourTiming } from "@/games/water-sort/ui/board/pour/pour-timing";
import { useAnimationFrame } from "@/games/water-sort/ui/board/pour/use-animation-frame";
import { TestTube } from "@/games/water-sort/ui/board/test-tube/TestTube";

type PourDestinationProps = {
  /** 同じ注ぎ先への注ぎ。成り立った順。 */
  animations: readonly PourAnimation[];
  clocks: PourClocks;
};

/** 栓を押し込み始めてから奥まで入るまでと、入ってからゴムの縮みが戻るまで。 */
const STOPPER_PRESS_MS = 25;
const STOPPER_RELEASE_MS = 70;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeInOut(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** 栓が上から下りて口に入り、押し込まれて縮み、戻る。 */
function getStopperStyle(timing: PourTiming, elapsedMs: number) {
  const { stopperStartMs, stopperSeatedMs } = timing;
  const pressStartMs = stopperSeatedMs - STOPPER_PRESS_MS;
  if (elapsedMs < stopperStartMs) {
    return { transform: "translateY(-16%) rotate(-6deg)", opacity: 0 };
  }
  if (elapsedMs < pressStartMs) {
    const p = easeInOut(
      (elapsedMs - stopperStartMs) / (pressStartMs - stopperStartMs),
    );
    return {
      transform: `translateY(${-16 + 11 * p}%) rotate(${-6 + 4 * p}deg)`,
      opacity: Math.min(1, p * 2.5),
    };
  }
  if (elapsedMs < stopperSeatedMs) {
    const p = clamp01((elapsedMs - pressStartMs) / STOPPER_PRESS_MS) ** 2;
    return {
      transform: `translateY(${-5 + 5.6 * p}%) rotate(${-2 + 2 * p}deg) scale(${1 + 0.06 * p}, ${1 - 0.1 * p})`,
      opacity: 1,
    };
  }
  const p =
    1 - (1 - clamp01((elapsedMs - stopperSeatedMs) / STOPPER_RELEASE_MS)) ** 2;
  return {
    transform: `translateY(${0.6 * (1 - p)}%) scale(${1.06 - 0.06 * p}, ${0.9 + 0.1 * p})`,
    opacity: 1,
  };
}

/**
 * 注ぎ先。流れが口から液面まで落ち、当たった所が乱れながら液面が上がる。1種類で満ちたらゴム栓をきゅっと差し込む。
 * 同じ注ぎ先へ続けて注いだときは、それぞれの注ぎの液を届いた順に積む。
 */
export function PourDestination({ animations, clocks }: PourDestinationProps) {
  const stopperRef = useRef<SVGSVGElement>(null);
  const first = animations[0];
  const last = animations[animations.length - 1];
  const sealing = last && isCompleteWaterSortBottle(last.destination.after);

  useAnimationFrame(function drawStopper() {
    const stopper = stopperRef.current;
    if (!stopper || !last || !sealing) {
      return;
    }
    const style = getStopperStyle(last.timing, clocks.getElapsedMs(last.id));
    stopper.style.transform = style.transform;
    stopper.style.opacity = String(style.opacity);
  });

  if (!first) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed"
      style={getOverlayStyle(
        first.destination.rect,
        POUR_LAYER_ORDER.destination,
      )}
    >
      <TestTube
        contents={first.destination.before}
        stoppered={sealing}
        stopperRef={stopperRef}
        sealTiming={
          sealing
            ? {
                filledMs: last.timing.landEndMs,
                stopperStartMs: last.timing.stopperStartMs,
              }
            : undefined
        }
        // それまでの液面の線は、流れが当たったときにほどけるか境目に変わるよう、注がれる液と一緒に描く。
        receivingSameReagent
        liquidOverlay={
          <>
            <IncomingLiquid animations={animations} clocks={clocks} />
            {animations.map((animation) => (
              <PourStream
                key={animation.id}
                animation={animation}
                animations={animations}
                clocks={clocks}
              />
            ))}
            {animations.map((animation) => (
              <PourImpact
                key={animation.id}
                animation={animation}
                animations={animations}
                clocks={clocks}
              />
            ))}
          </>
        }
      />
    </div>
  );
}
