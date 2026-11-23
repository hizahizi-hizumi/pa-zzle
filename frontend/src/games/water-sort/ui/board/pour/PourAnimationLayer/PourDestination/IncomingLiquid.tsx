import { useRef } from "react";
import { getDestinationFill } from "@/games/water-sort/ui/board/pour/destination-fill";
import type { PourClocks } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { getStreamRatioInBox } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/stream-geometry";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { useAnimationFrame } from "@/games/water-sort/ui/board/pour/use-animation-frame";
import { LiquidSurface } from "@/games/water-sort/ui/board/test-tube/LiquidSurface";
import { getReagentColor } from "@/games/water-sort/ui/board/test-tube/reagent";

type IncomingLiquidProps = {
  /** 同じ注ぎ先への注ぎ。成り立った順。 */
  animations: readonly PourAnimation[];
  clocks: PourClocks;
};

/** 流れが届いてから、それまでの液面がほどけて消えるまでの長さ。 */
const SURFACE_SETTLE_MS = 260;

function easeOutCubic(value: number): number {
  return 1 - (1 - Math.min(1, Math.max(0, value))) ** 3;
}

/**
 * 注ぎ先に満ちていく液。注げるのは空の試験管か同じ試薬の上なので、注いだ液はそれまでの液とひとつの層として満ちる。
 * 流れが当たった瞬間、それまでの液面が当たった所から左右へほどけて消え、ひとつの液になる。
 */
export function IncomingLiquid({ animations, clocks }: IncomingLiquidProps) {
  const liquidRef = useRef<HTMLSpanElement>(null);
  const formerSurfaceRef = useRef<HTMLSpanElement>(null);
  const formerLeftRef = useRef<HTMLSpanElement>(null);
  const formerRightRef = useRef<HTMLSpanElement>(null);
  const first = animations[0];
  const base = first?.destination.before ?? [];

  useAnimationFrame(function drawIncomingLiquid() {
    const fill = getDestinationFill(animations, clocks.getElapsedMs);
    if (!fill || !first) {
      return;
    }
    const liquid = liquidRef.current;
    if (liquid) {
      liquid.style.visibility = fill.incoming ? "visible" : "hidden";
      if (fill.incoming) {
        liquid.style.bottom = `${fill.incoming.fromSlot * 25}%`;
        liquid.style.height = `calc(${(fill.incoming.toSlot - fill.incoming.fromSlot) * 25}% + 0.5px)`;
      }
    }

    const sinceLanding =
      clocks.getElapsedMs(first.id) - first.timing.landStartMs;
    const settled = easeOutCubic(sinceLanding / SURFACE_SETTLE_MS);
    if (formerSurfaceRef.current && sinceLanding >= 0) {
      // 流れの当たる所から左右の壁へ向けて、液面がほどける。
      const gap = settled * 60;
      const center = getStreamRatioInBox(first) * 100;
      formerSurfaceRef.current.style.opacity = String(1 - settled);
      if (formerLeftRef.current) {
        formerLeftRef.current.style.right = `${Math.min(100, 100 - (center - gap))}%`;
      }
      if (formerRightRef.current) {
        formerRightRef.current.style.left = `${Math.min(100, center + gap)}%`;
      }
    }
  });

  if (!first) {
    return null;
  }
  const streamCenter = getStreamRatioInBox(first) * 100;

  return (
    <>
      <span
        ref={liquidRef}
        className="absolute inset-x-0 invisible"
        style={{ backgroundColor: getReagentColor(first.colorIndex) }}
      >
        <LiquidSurface />
      </span>
      {base.length > 0 && (
        <span
          ref={formerSurfaceRef}
          className="absolute inset-x-0 h-[4px] translate-y-full"
          style={{ bottom: `${base.length * 25}%` }}
        >
          <span
            ref={formerLeftRef}
            className="absolute inset-y-0 left-0"
            style={{ right: `${100 - streamCenter}%` }}
          >
            <LiquidSurface />
          </span>
          <span
            ref={formerRightRef}
            className="absolute inset-y-0 right-0"
            style={{ left: `${streamCenter}%` }}
          >
            <LiquidSurface />
          </span>
        </span>
      )}
    </>
  );
}
