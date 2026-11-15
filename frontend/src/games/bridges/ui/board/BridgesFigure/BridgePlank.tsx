import {
  bridgesFigureParts,
  PLANK_RAIL_WIDTH,
  PLANK_SEAM_DASH,
  SHADOW_OFFSET,
} from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import type { LitDeckWave } from "@/games/bridges/ui/board/BridgesFigure/figure-contract";
import { SegmentLine } from "@/games/bridges/ui/board/BridgesFigure/SegmentLine";
import type { BoardSegment } from "@/games/bridges/ui/board/board-geometry";
import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

type BridgePlankProps = {
  segment: BoardSegment;
  width: number;
  seams: boolean;
  litWave?: LitDeckWave | null;
};

/**
 * `litWave` を渡すと、全島がつながった盤面の明るい木の色の面を、板の面と横木の間に重ねる。渡り切った姿で描き、
 * 演出がその姿へ向けて光を渡す。
 */
export function BridgePlank({
  segment,
  width,
  seams,
  litWave = null,
}: BridgePlankProps) {
  const shadow = {
    start: {
      x: segment.start.x + SHADOW_OFFSET.x,
      y: segment.start.y + SHADOW_OFFSET.y,
    },
    end: {
      x: segment.end.x + SHADOW_OFFSET.x,
      y: segment.end.y + SHADOW_OFFSET.y,
    },
  };
  const deckWidth = width - 2 * PLANK_RAIL_WIDTH;
  return (
    <>
      <g {...{ [bridgesFigureParts.plankShadow]: "" }}>
        <SegmentLine
          segment={shadow}
          className={bridgesToneClassNames.bridgeShadow}
          strokeWidth={width}
        />
      </g>
      <SegmentLine
        segment={segment}
        className={bridgesToneClassNames.bridgeRail}
        strokeWidth={width}
      />
      <SegmentLine
        segment={segment}
        className={bridgesToneClassNames.bridgeDeck}
        strokeWidth={deckWidth}
      />
      {litWave !== null && (
        <g
          {...{ [bridgesFigureParts.litDeck]: litWave.depth }}
          data-axis={segment.start.y === segment.end.y ? "x" : "y"}
          data-spread={litWave.origin === null ? "fade" : "travel"}
          style={
            litWave.origin === null
              ? undefined
              : {
                  transformBox: "view-box",
                  transformOrigin: `${litWave.origin.x}px ${litWave.origin.y}px`,
                }
          }
        >
          <SegmentLine
            segment={segment}
            className={bridgesToneClassNames.bridgeDeckLit}
            strokeWidth={deckWidth}
          />
        </g>
      )}
      {seams && (
        <SegmentLine
          segment={segment}
          className={bridgesToneClassNames.bridgeSeam}
          strokeWidth={deckWidth}
          strokeDasharray={PLANK_SEAM_DASH}
        />
      )}
    </>
  );
}
