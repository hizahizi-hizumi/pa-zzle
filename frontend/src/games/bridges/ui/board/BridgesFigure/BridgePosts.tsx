import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { POST_RADIUS } from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import type { PlankLayout } from "@/games/bridges/ui/board/BridgesFigure/figure-contract";
import { listPostPoints } from "@/games/bridges/ui/board/BridgesFigure/figure-layout";
import type { BoardSegment } from "@/games/bridges/ui/board/board-geometry";
import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

type BridgePostsProps = {
  segment: BoardSegment;
  count: BridgeCount;
  layout: PlankLayout;
};

export function BridgePosts({ segment, count, layout }: BridgePostsProps) {
  return (
    <g className={bridgesToneClassNames.bridgePost}>
      {listPostPoints(segment, count, layout).map((point) => (
        <circle
          key={`${point.x}:${point.y}`}
          cx={point.x}
          cy={point.y}
          r={POST_RADIUS}
        />
      ))}
    </g>
  );
}
