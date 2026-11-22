import { type RefObject, useLayoutEffect, useRef, useState } from "react";

import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import {
  measureRackLayout,
  type RackLayout,
} from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/rack-layout";
import { TestTubeRackScene } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/TestTubeRackScene";

type TestTubeRackProps = {
  state: WaterSortState;
  /** 盤面の試験管の要素（並び順は番号順）。試験管立ての穴と板を、その位置に合わせる。 */
  bottleRefs: RefObject<Array<HTMLElement | null>>;
};

/** 試験管を立てる木の試験管立てと、それを置く黒い実験台・流しの戸棚。置いた入れ物いっぱいに重ね、操作を受けない。 */
export function TestTubeRack({ state, bottleRefs }: TestTubeRackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<RackLayout | null>(null);
  const bottleCount = state.length;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || bottleCount === 0) {
      return;
    }
    function listBottles(): HTMLElement[] {
      return bottleRefs.current
        .slice(0, bottleCount)
        .filter((element) => element !== null);
    }
    function measure() {
      if (container) {
        setLayout(measureRackLayout(container, listBottles()));
      }
    }
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const bottle of listBottles()) {
      observer.observe(bottle);
    }
    return () => observer.disconnect();
  }, [bottleRefs, bottleCount]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
    >
      {layout && <TestTubeRackScene layout={layout} state={state} />}
    </div>
  );
}
