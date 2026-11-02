import type { Ref } from "react";

import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  type BoardSegment,
  getBridgeLineOffsets,
  getEdgeSegment,
  getIslandCenter,
  ISLAND_RADIUS,
} from "@/games/bridges/ui/board/board-geometry";
import {
  bridgesIslandTones,
  bridgesToneClassNames,
} from "@/games/bridges/ui/bridges-tone";
import { cn } from "@/lib/utils";

/**
 * 島を押している間の、架けられる相手への線。
 * - `edges`: 押した島から伸びる辺。
 * - `previewEdge`: 今離せば橋を回す辺。決まらなければ `null`。
 */
export type BridgesFigureGuide = {
  edges: readonly number[];
  previewEdge: number | null;
};

type BridgesFigureProps = {
  board: BridgesBoard;
  /** 辺ごとの橋の本数。 */
  bridges: readonly BridgeCount[];
  /** 島ごとの、橋の本数と数字の比べ。 */
  islandStatuses: readonly BridgesIslandStatus[];
  guide?: BridgesFigureGuide | null;
  /** キーボードで選んでいる島。輪で囲む。 */
  focusedIsland?: number | null;
  /** 交わる橋に阻まれたとき、阻んだ橋の辺。点ける線を描いておき、盤面の反応で短く点ける。 */
  blockingEdges?: readonly number[];
  /** 阻んだ橋の線を点けたまま描くか。遊び方の図で、阻まれたときの盤面の反応を見せるときに使う。 */
  showsBlockingEdges?: boolean;
  /** 丸を淡い黄色で塗る島。難易度プレビューで、数字の読みだけでは橋が決まらない島を示す。 */
  highlightedIslands?: readonly number[];
  /** どちらを狙ったか決まらない所を押したとき、候補の辺。点ける線を描いておき、盤面の反応で短く点ける。 */
  ambiguousEdges?: readonly number[];
  ref?: Ref<SVGSVGElement>;
};

/** 演出が図の部品を探すための属性。 */
export const bridgesFigureParts = {
  island: "data-bridges-island",
  blockingBridges: "data-bridges-blocking",
  ambiguousEdges: "data-bridges-ambiguous",
} as const;

/** 図の寸法はマス幅を 1 とした値。 */
const BRIDGE_LINE_WIDTH = 0.08;
/** 阻んだ橋を点ける線の太さ。橋の線より太くし、橋の上に重ねても見分けられるようにする。 */
const BLOCKING_LINE_WIDTH = 0.16;
const GUIDE_LINE_WIDTH = 0.06;
const GUIDE_PREVIEW_LINE_WIDTH = 0.14;
const FOCUS_RING_RADIUS = ISLAND_RADIUS + 0.07;
const FOCUS_RING_WIDTH = 0.05;
/** 数字の字の大きさ。島の丸の直径の6割ほどにする。 */
const CLUE_FONT_SIZE = 0.48;

function renderSegment(
  { start, end }: BoardSegment,
  key: string,
  offset = 0,
  horizontal = true,
) {
  return (
    <line
      key={key}
      x1={start.x + (horizontal ? 0 : offset)}
      y1={start.y + (horizontal ? offset : 0)}
      x2={end.x + (horizontal ? 0 : offset)}
      y2={end.y + (horizontal ? offset : 0)}
    />
  );
}

/**
 * 盤面の絵。下から、地・架けられる相手への線・橋・阻んだ橋の点灯・決まらない所の候補の点灯・島の丸と数字・キーボードの輪の順に重ねる。
 * 島は橋の端を覆うので、橋と点灯の線の上に置く。
 */
export function BridgesFigure({
  board,
  bridges,
  islandStatuses,
  guide = null,
  focusedIsland = null,
  blockingEdges = [],
  showsBlockingEdges = false,
  highlightedIslands = [],
  ambiguousEdges = [],
  ref,
}: BridgesFigureProps) {
  const { width, height, islands } = board;
  const { edges } = getBridgesNetwork(board);
  const focusedCenter =
    focusedIsland === null
      ? null
      : getIslandCenter(board.islands[focusedIsland]!);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <rect
        width={width}
        height={height}
        className={bridgesToneClassNames.ground}
      />
      {guide && (
        <g strokeLinecap="round">
          <g
            className={bridgesToneClassNames.guide}
            strokeWidth={GUIDE_LINE_WIDTH}
          >
            {guide.edges.map((edge) =>
              renderSegment(getEdgeSegment(board, edge), `guide-${edge}`),
            )}
          </g>
          {guide.previewEdge !== null && (
            <g
              className={bridgesToneClassNames.guidePreview}
              strokeWidth={GUIDE_PREVIEW_LINE_WIDTH}
            >
              {renderSegment(
                getEdgeSegment(board, guide.previewEdge),
                "preview",
              )}
            </g>
          )}
        </g>
      )}
      <g
        className={bridgesToneClassNames.bridge}
        strokeWidth={BRIDGE_LINE_WIDTH}
      >
        {edges.map(({ from, to, orientation }, edge) =>
          getBridgeLineOffsets(bridges[edge]!).map((offset) =>
            renderSegment(
              getEdgeSegment(board, edge),
              `${from}-${to}:${offset}`,
              offset,
              orientation === "horizontal",
            ),
          ),
        )}
      </g>
      <g
        {...{ [bridgesFigureParts.blockingBridges]: "" }}
        className={bridgesToneClassNames.blockingBridge}
        strokeWidth={BLOCKING_LINE_WIDTH}
        strokeLinecap="round"
        opacity={showsBlockingEdges ? 1 : 0}
      >
        {blockingEdges.map((edge) =>
          renderSegment(getEdgeSegment(board, edge), `blocking-${edge}`),
        )}
      </g>
      <g
        {...{ [bridgesFigureParts.ambiguousEdges]: "" }}
        className={bridgesToneClassNames.guidePreview}
        strokeWidth={GUIDE_PREVIEW_LINE_WIDTH}
        strokeLinecap="round"
        opacity={0}
      >
        {ambiguousEdges.map((edge) =>
          renderSegment(getEdgeSegment(board, edge), `ambiguous-${edge}`),
        )}
      </g>
      {islands.map((island, index) => {
        const { x, y } = getIslandCenter(island);
        const tone = bridgesIslandTones[islandStatuses[index]!];
        return (
          <g
            key={`${island.row}:${island.column}`}
            {...{ [bridgesFigureParts.island]: index }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <circle
              cx={x}
              cy={y}
              r={ISLAND_RADIUS - tone.outlineWidth / 2}
              strokeWidth={tone.outlineWidth}
              className={cn(
                tone.disc,
                highlightedIslands.includes(index) &&
                  bridgesToneClassNames.highlightedIsland,
              )}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={CLUE_FONT_SIZE}
              fontWeight={700}
              className={cn("select-none font-sans", tone.clue)}
            >
              {island.clue}
            </text>
          </g>
        );
      })}
      {focusedCenter && (
        <circle
          cx={focusedCenter.x}
          cy={focusedCenter.y}
          r={FOCUS_RING_RADIUS}
          fill="none"
          strokeWidth={FOCUS_RING_WIDTH}
          className={bridgesToneClassNames.focusRing}
        />
      )}
    </svg>
  );
}
