import { useLayoutEffect, useRef, useState } from "react";

import { LabRackScene } from "@/games/water-sort/ui/ideas/lab/LabBoardBackdrop/LabRackScene";
import {
  measureRackLayout,
  type RackLayout,
} from "@/games/water-sort/ui/ideas/lab/rack-layout";
import type { BoardBackdropProps } from "@/games/water-sort/ui/ideas/overrides";

/** 試験管を立てる木の試験管立てと、それを置く黒い実験台・流しの戸棚。 */
export function LabBoardBackdrop({
  state,
  getBottleElements,
}: BoardBackdropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<RackLayout | null>(null);
  const bottleCount = state.length;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || bottleCount === 0) {
      return;
    }
    function measure() {
      if (container) {
        setLayout(measureRackLayout(container, getBottleElements()));
      }
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    const board = getBottleElements()[0]?.parentElement;
    if (board) {
      observer.observe(board);
    }
    return () => observer.disconnect();
  }, [getBottleElements, bottleCount]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {layout && <LabRackScene layout={layout} state={state} />}
    </div>
  );
}
