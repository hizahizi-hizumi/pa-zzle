import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { BridgePlank } from "@/games/bridges/ui/board/BridgesFigure/BridgePlank";
import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import type {
  LitDeckWave,
  PlankLayout,
} from "@/games/bridges/ui/board/BridgesFigure/figure-contract";
import {
  getPlankOffsets,
  getPlankWidth,
  offsetSegment,
} from "@/games/bridges/ui/board/BridgesFigure/figure-layout";
import type { BoardSegment } from "@/games/bridges/ui/board/board-geometry";

type BridgePlanksProps = {
  segment: BoardSegment;
  count: BridgeCount;
  layout: PlankLayout;
  litWave?: LitDeckWave | null;
};

export function BridgePlanks({
  segment,
  count,
  layout,
  litWave = null,
}: BridgePlanksProps) {
  return getPlankOffsets(count, layout).map((offset, plank) => (
    <g key={offset} {...{ [bridgesFigureParts.bridgePlank]: plank }}>
      <BridgePlank
        segment={offsetSegment(segment, offset)}
        width={getPlankWidth(count, layout)}
        seams={layout.seams}
        litWave={litWave}
      />
    </g>
  ));
}
