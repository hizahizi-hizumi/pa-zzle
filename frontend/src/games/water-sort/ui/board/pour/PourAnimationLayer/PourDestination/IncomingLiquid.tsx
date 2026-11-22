import { useRef } from "react";
import { useWaterSortArt } from "@/games/water-sort/ui/art/art-registry";
import { getDestinationFill } from "@/games/water-sort/ui/board/pour/destination-fill";
import type { PourClocks } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { getStreamRatioInBox } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/stream-geometry";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { useAnimationFrame } from "@/games/water-sort/ui/board/pour/use-animation-frame";

type IncomingLiquidProps = {
  /** 同じ注ぎ先への注ぎ。成り立った順。 */
  animations: readonly PourAnimation[];
  clocks: PourClocks;
};

/** 流れが届いてから、それまでの液面の線がほどけて消えるまでの長さ。 */
const SURFACE_SETTLE_MS = 260;

function getMeniscusImage(shade: number): string {
  return `linear-gradient(180deg, rgba(20,30,35,${shade}) 0, rgba(20,30,35,${shade}) 1px, rgba(255,255,255,0.6) 1px, rgba(255,255,255,0.15) 2.5px, transparent 4px)`;
}

function easeOutCubic(value: number): number {
  return 1 - (1 - Math.min(1, Math.max(0, value))) ** 3;
}

/**
 * 注ぎ先に満ちていく液。注げるのは空の試験管か同じ試薬の上なので、注いだ液はそれまでの液とひとつの層として満ちる。
 * 流れが当たった瞬間、それまでの液面の線が当たった所から左右へほどけて消え、ひとつの液になる。
 */
export function IncomingLiquid({ animations, clocks }: IncomingLiquidProps) {
  const reagentArt = useWaterSortArt().reagent;
  const liquidRef = useRef<HTMLSpanElement>(null);
  const formerSurfaceRef = useRef<HTMLSpanElement>(null);
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
    const formerSurface = formerSurfaceRef.current;
    if (formerSurface && sinceLanding >= 0) {
      // 流れの当たる所から左右の壁へ向けて、線がほどける。
      const gap = settled * 60;
      const center = getStreamRatioInBox(first) * 100;
      const mask = `linear-gradient(90deg, black 0, black ${center - gap}%, transparent ${center - gap}%, transparent ${center + gap}%, black ${center + gap}%)`;
      formerSurface.style.opacity = String(1 - settled);
      formerSurface.style.maskImage = mask;
      formerSurface.style.webkitMaskImage = mask;
    }
  });

  if (!first) {
    return null;
  }

  return (
    <>
      <span
        ref={liquidRef}
        className="absolute inset-x-0 invisible"
        style={reagentArt.fill(first.colorIndex)}
      >
        <span
          className="absolute inset-x-0 top-0 h-[4px]"
          style={{
            backgroundImage: getMeniscusImage(
              reagentArt.surfaceShade(first.colorIndex),
            ),
          }}
        />
      </span>
      {base.length > 0 && (
        <span
          ref={formerSurfaceRef}
          className="absolute inset-x-0 h-[4px] translate-y-full"
          style={{
            bottom: `${base.length * 25}%`,
            backgroundImage: getMeniscusImage(
              reagentArt.surfaceShade(first.colorIndex),
            ),
          }}
        />
      )}
    </>
  );
}
