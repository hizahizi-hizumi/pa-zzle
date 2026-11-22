import { useRef } from "react";
import { getDestinationFill } from "@/games/water-sort/ui/board/pour/destination-fill";
import type { PourClocks } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import {
  getLiquidBox,
  getStreamX,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/stream-geometry";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import {
  getFlowRate,
  POUR_FALL_MS,
} from "@/games/water-sort/ui/board/pour/pour-timing";
import { useAnimationFrame } from "@/games/water-sort/ui/board/pour/use-animation-frame";
import { getReagentStreamFill } from "@/games/water-sort/ui/board/test-tube/reagent";

type PourStreamProps = {
  animation: PourAnimation;
  /** 同じ注ぎ先への注ぎ。流れは、それらが積んだ今の液面まで落ちる。 */
  animations: readonly PourAnimation[];
  clocks: PourClocks;
};

/** いちばん太いときの流れの太さ（注ぎ先の幅に対する割合）と、その上限・下限（px）。 */
const STREAM_WIDTH_RATIO = 0.085;
const MIN_STREAM_WIDTH_PX = 2.2;
const MAX_STREAM_WIDTH_PX = 6.5;
/** 落ちながら速まって細る流れの、液面での太さ（口での太さに対する割合）。 */
const STREAM_LANDING_WIDTH_RATIO = 0.7;
/** 出始めと出終わりの細い流れの太さ（いちばん太いときに対する割合）。 */
const THINNEST_STREAM_RATIO = 0.35;

/** 口を離れてから `sinceMs` 経った液が、液面までのうちどこまで落ちたか（0〜1）。落ちるほど速まる。 */
function getFallenRatio(sinceMs: number): number {
  return Math.min(1, Math.max(0, sinceMs / POUR_FALL_MS)) ** 2;
}

function getMaxStreamWidth(animation: PourAnimation): number {
  return Math.min(
    MAX_STREAM_WIDTH_PX,
    Math.max(
      MIN_STREAM_WIDTH_PX,
      animation.destination.rect.width * STREAM_WIDTH_RATIO,
    ),
  );
}

/**
 * 注ぎ元の口の縁から注ぎ先の液面（空なら底）まで落ちる、細い液の流れ。
 * 落ち始めは先が液面へ伸び、注ぎ終わると口から離れた最後が液面へ落ちる。注ぐ勢いに合わせて太さが変わる。
 * 注ぎ先のガラスの奥に描き、口から上は注ぎ元の試験管の陰に入る。
 */
export function PourStream({ animation, animations, clocks }: PourStreamProps) {
  const streamRef = useRef<HTMLSpanElement>(null);
  const { timing, path, destination } = animation;
  const maxWidth = getMaxStreamWidth(animation);
  const top = path.lip.y;
  const box = getLiquidBox(destination.rect);
  const height = box.bottom - top;

  useAnimationFrame(function drawPourStream() {
    const element = streamRef.current;
    const fill = getDestinationFill(animations, clocks.getElapsedMs);
    if (!element || !fill) {
      return;
    }
    const elapsedMs = clocks.getElapsedMs(animation.id);
    const surface = box.bottom - fill.surfaceSlots * box.slotHeight - top;
    const head = surface * getFallenRatio(elapsedMs - timing.touchMs);
    const tail = surface * getFallenRatio(elapsedMs - timing.flowEndMs);
    if (head <= tail) {
      element.style.visibility = "hidden";
      return;
    }
    const flowProgress =
      (elapsedMs - timing.touchMs) / (timing.flowEndMs - timing.touchMs);
    const rate = getFlowRate(Math.min(flowProgress, 0.999));
    const width =
      maxWidth * (THINNEST_STREAM_RATIO + (1 - THINNEST_STREAM_RATIO) * rate);
    const landingWidth = width * STREAM_LANDING_WIDTH_RATIO;
    // 落ちる液がわずかに揺れる。
    const sway = Math.sin(elapsedMs / 47) * 0.25;
    const center = maxWidth / 2;
    element.style.visibility = "visible";
    element.style.clipPath = `polygon(${center - width / 2}px ${tail}px, ${center + width / 2}px ${tail}px, ${center + sway + landingWidth / 2}px ${head}px, ${center + sway - landingWidth / 2}px ${head}px)`;
  });

  return (
    <span
      ref={streamRef}
      aria-hidden="true"
      // 注ぎ先のガラスの奥に描くが、液を収める箱の切り抜きの外（口から上）にも落ちるので、切り抜きから出す。
      // 注ぎ先は transform を持たないので、fixed の基準は注ぎ先の重なりと同じになる。
      className="invisible fixed"
      style={{
        left: `${getStreamX(animation) - maxWidth / 2}px`,
        top: `${top}px`,
        width: `${maxWidth}px`,
        height: `${Math.max(0, height)}px`,
        ...getReagentStreamFill(animation.colorIndex),
      }}
    />
  );
}
