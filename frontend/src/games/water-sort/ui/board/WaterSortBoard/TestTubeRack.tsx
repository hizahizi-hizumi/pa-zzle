import { type RefObject, useLayoutEffect, useRef, useState } from "react";

import { RackScene } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/RackScene";
import {
  measureRackLayout,
  type RackLayout,
} from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/rack-layout";

type TestTubeRackProps = {
  bottleCount: number;
  /** 盤面の試験管の要素（並び順は番号順）。試験管立てと理科室の飾りを、その位置に合わせる。 */
  bottleRefs: RefObject<Array<HTMLElement | null>>;
};

/**
 * 試験管を立てる木の試験管立てと、そのまわりの理科室（窓・実験台・流しの戸棚）。盤面の試験管の位置を測って合わせる。
 * 置いた入れ物いっぱいに盤面の後ろへ重ね、操作を受けない。
 */
export function TestTubeRack({ bottleCount, bottleRefs }: TestTubeRackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<RackLayout | null>(null);

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
      {layout && <RackScene layout={layout} />}
    </div>
  );
}
