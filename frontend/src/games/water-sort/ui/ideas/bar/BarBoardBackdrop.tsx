import { useLayoutEffect, useRef, useState } from "react";

import { CounterSurface } from "@/games/water-sort/ui/ideas/bar/BarBoardBackdrop/CounterSurface";
import { GlassReflection } from "@/games/water-sort/ui/ideas/bar/BarBoardBackdrop/GlassReflection";
import {
  type CounterLayout,
  measureCounterLayout,
} from "@/games/water-sort/ui/ideas/bar/bar-counter-layout";
import type { BoardBackdropProps } from "@/games/water-sort/ui/ideas/overrides";

type CounterGlass = CounterLayout["glasses"][number];

/** 前の列のグラスの口までの間。映り込みがそこを越えると、空のグラスに液が入って見える。 */
function getReflectionRoom(layout: CounterLayout, glass: CounterGlass) {
  const below = layout.glasses
    .filter(
      (other) =>
        other.bottom > glass.bottom &&
        other.left < glass.left + glass.width &&
        other.left + other.width > glass.left,
    )
    .map((other) => other.bottom - other.height - glass.bottom);
  return below.length > 0 ? Math.max(0, Math.min(...below) - 2) : Infinity;
}

/** 磨いた木のカウンター。奥の列のグラスの足もとから画面の下まで続き、グラスと液が映り込む。 */
export function BarBoardBackdrop({
  state,
  getBottleElements,
}: BoardBackdropProps) {
  const originRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<CounterLayout | null>(null);
  const bottleCount = state.length;

  useLayoutEffect(() => {
    const origin = originRef.current;
    if (!origin || bottleCount === 0) {
      return;
    }
    function measure() {
      if (origin) {
        setLayout(measureCounterLayout(origin, getBottleElements()));
      }
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(origin);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [getBottleElements, bottleCount]);

  const counterHeight = layout
    ? layout.viewportHeight - layout.originTop - layout.backEdgeY
    : 0;

  return (
    <div ref={originRef} className="absolute inset-0">
      {layout && counterHeight > 0 && (
        <div
          className="absolute overflow-hidden"
          style={{
            left: -layout.originLeft,
            top: layout.backEdgeY,
            width: layout.viewportWidth,
            height: counterHeight,
          }}
        >
          <CounterSurface
            width={layout.viewportWidth}
            height={counterHeight}
            lightY={(layout.glasses[0]?.bottom ?? 0) - layout.backEdgeY}
          />
          {layout.glasses.map((glass) => (
            <GlassReflection
              key={glass.bottleIndex}
              contents={state[glass.bottleIndex] ?? []}
              left={glass.left + layout.originLeft}
              top={glass.bottom - layout.backEdgeY}
              width={glass.width}
              height={glass.height}
              maxLength={getReflectionRoom(layout, glass)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
