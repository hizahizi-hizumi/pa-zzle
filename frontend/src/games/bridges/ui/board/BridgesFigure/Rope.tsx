import {
  bridgesFigureParts,
  ROPE_CASING_EXTRA,
  ROPE_DASH,
} from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import { SegmentLine } from "@/games/bridges/ui/board/BridgesFigure/SegmentLine";
import type { BoardSegment } from "@/games/bridges/ui/board/board-geometry";
import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

type RopeProps = {
  edge: number;
  segment: BoardSegment;
  strokeWidth: number;
  dashed: boolean;
  opacity: number;
};

export function Rope({
  edge,
  segment,
  strokeWidth,
  dashed,
  opacity,
}: RopeProps) {
  return (
    <g {...{ [bridgesFigureParts.rope]: edge }} opacity={opacity}>
      <SegmentLine
        segment={segment}
        className={bridgesToneClassNames.guideCasing}
        strokeWidth={strokeWidth + ROPE_CASING_EXTRA}
      />
      <SegmentLine
        segment={segment}
        className={bridgesToneClassNames.guide}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? ROPE_DASH : undefined}
      />
    </g>
  );
}
