import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  GHOST_EXTRA_WIDTH,
  REMOVAL_EXTRA_WIDTH,
} from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import type { PlankLayout } from "@/games/bridges/ui/board/BridgesFigure/figure-contract";
import {
  getFootprintHalfWidth,
  getPlankOffsets,
  getPlankWidth,
  offsetSegment,
} from "@/games/bridges/ui/board/BridgesFigure/figure-layout";
import { SegmentLine } from "@/games/bridges/ui/board/BridgesFigure/SegmentLine";
import type { BoardSegment } from "@/games/bridges/ui/board/board-geometry";
import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

type GhostBridgeProps = {
  segment: BoardSegment;
  current: BridgeCount;
  layout: PlankLayout;
  opacity?: number;
};

export function GhostBridge({
  segment,
  current,
  layout,
  opacity = 1,
}: GhostBridgeProps) {
  const next = ((current + 1) % 3) as BridgeCount;
  if (next === 0) {
    return (
      <SegmentLine
        segment={segment}
        className={bridgesToneClassNames.guideRemoval}
        strokeWidth={
          getFootprintHalfWidth(current, layout) * 2 + REMOVAL_EXTRA_WIDTH
        }
        opacity={opacity}
      />
    );
  }
  return (
    <g opacity={opacity}>
      {getPlankOffsets(next, layout).map((offset) => (
        <SegmentLine
          key={offset}
          segment={offsetSegment(segment, offset)}
          className={bridgesToneClassNames.guideGhost}
          strokeWidth={getPlankWidth(next, layout) + GHOST_EXTRA_WIDTH}
        />
      ))}
    </g>
  );
}
