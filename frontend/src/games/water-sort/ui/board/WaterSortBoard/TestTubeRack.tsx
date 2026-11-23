import { type RefObject, useLayoutEffect, useRef, useState } from "react";

import { WATER_SORT_RACK_OVERHANG_RATIO } from "@/games/water-sort/ui/board/rack-extent";
import { TUBE_OUTER } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";
import {
  measureRackLayout,
  type RackLayout,
} from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/rack-layout";

type TestTubeRackProps = {
  bottleCount: number;
  /** 盤面の試験管の要素（並び順は番号順）。試験管立ての板を、その位置に合わせる。 */
  bottleRefs: RefObject<Array<HTMLElement | null>>;
};

/** 試験管の底が板に沈む深さと、板の厚さ（試験管の高さに対する割合）。 */
const BOARD_SINK_RATIO = 0.03;
const BOARD_THICKNESS_RATIO = 0.035;
const MIN_BOARD_THICKNESS_PX = 3;

/**
 * 試験管を立てる試験管立て。段ごとに、試験管の底を受ける細い板1枚を、地に近い色の平らな面で描く。
 * 置いた入れ物いっぱいに重ね、操作を受けない。
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

  const overhang = layout
    ? layout.tubeWidth * WATER_SORT_RACK_OVERHANG_RATIO
    : 0;
  const boardHeight = layout
    ? Math.max(
        MIN_BOARD_THICKNESS_PX,
        layout.tubeHeight * BOARD_THICKNESS_RATIO,
      )
    : 0;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
    >
      {layout && (
        <svg
          width={layout.width}
          height={layout.height}
          className="absolute top-0 left-0 overflow-visible fill-[#cad8dd] dark:fill-[#2b3b40]"
          aria-hidden="true"
        >
          {layout.rows.map((row) => (
            <rect
              key={row.top}
              x={layout.left - overhang}
              y={
                row.top +
                layout.tubeHeight * (TUBE_OUTER.bottom / 100 - BOARD_SINK_RATIO)
              }
              width={layout.right - layout.left + overhang * 2}
              height={boardHeight}
              rx={boardHeight / 2}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
