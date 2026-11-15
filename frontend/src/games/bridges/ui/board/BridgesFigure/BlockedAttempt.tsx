import { BridgePlank } from "@/games/bridges/ui/board/BridgesFigure/BridgePlank";
import {
  BLOCKED_ATTEMPT_OPACITY,
  bridgesFigureParts,
} from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import type { PlankLayout } from "@/games/bridges/ui/board/BridgesFigure/figure-contract";
import { getPlankWidth } from "@/games/bridges/ui/board/BridgesFigure/figure-layout";
import type { BoardSegment } from "@/games/bridges/ui/board/board-geometry";

type BlockedAttemptProps = {
  segment: BoardSegment;
  layout: PlankLayout;
  opacity: number;
};

/** `opacity` は盤面の反応で一瞬だけ点けるための濃さで、点いたときも板は半透明のままにする。 */
export function BlockedAttempt({
  segment,
  layout,
  opacity,
}: BlockedAttemptProps) {
  const horizontal = segment.start.y === segment.end.y;
  return (
    <g
      {...{ [bridgesFigureParts.blockedAttempt]: "" }}
      data-axis={horizontal ? "x" : "y"}
      opacity={opacity}
      style={{
        transformBox: "view-box",
        transformOrigin: `${segment.start.x}px ${segment.start.y}px`,
      }}
    >
      <g opacity={BLOCKED_ATTEMPT_OPACITY}>
        <BridgePlank
          segment={segment}
          width={getPlankWidth(1, layout)}
          seams={layout.seams}
        />
      </g>
    </g>
  );
}
