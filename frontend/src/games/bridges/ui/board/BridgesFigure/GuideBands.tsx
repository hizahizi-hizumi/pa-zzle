import { GUIDE_BAND_WIDTH } from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import {
  type BoardView,
  getEdgeViewSegment,
} from "@/games/bridges/ui/board/board-geometry";
import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

type GuideBandsProps = {
  view: BoardView;
  edges: readonly number[];
};

/** どの相手へ架けられるかを、ロープより広い面で示す。 */
export function GuideBands({ view, edges }: GuideBandsProps) {
  return (
    <g className={bridgesToneClassNames.guideBand}>
      {edges.map((edge) => {
        const { start, end } = getEdgeViewSegment(view, edge);
        const half = GUIDE_BAND_WIDTH / 2;
        return (
          <rect
            key={edge}
            x={Math.min(start.x, end.x) - half}
            y={Math.min(start.y, end.y) - half}
            width={Math.abs(end.x - start.x) + GUIDE_BAND_WIDTH}
            height={Math.abs(end.y - start.y) + GUIDE_BAND_WIDTH}
            rx={half}
          />
        );
      })}
    </g>
  );
}
