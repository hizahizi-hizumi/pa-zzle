import { type Ref, useId } from "react";

import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  type BoardPoint,
  type BoardSegment,
  type BoardView,
  createBoardView,
  getBridgeLineOffsets,
  getEdgeViewSegment,
  getIslandCenter,
  ISLAND_RADIUS,
  toViewPoint,
} from "@/games/bridges/ui/board/board-geometry";
import { listClearWaveDepths } from "@/games/bridges/ui/board/clear-wave";
import {
  bridgesIslandTones,
  bridgesToneClassNames,
} from "@/games/bridges/ui/bridges-tone";
import { cn } from "@/lib/utils";

/**
 * 島から架けられる相手への線。島を押している間と、島を選んでいる間に見せる。
 * - `edges`: 島から伸びる辺。
 * - `previewEdge`: 今離せば橋を回す辺。決まらなければ `null`。
 */
export type BridgesFigureGuide = {
  edges: readonly number[];
  previewEdge: number | null;
};

type BridgesFigureProps = {
  board: BridgesBoard;
  /** 絵の座標。省略すると、行の間隔を広げない座標で描く。 */
  view?: BoardView;
  /** 辺ごとの橋の本数。 */
  bridges: readonly BridgeCount[];
  /** 島ごとの、橋の本数と数字の比べ。 */
  islandStatuses: readonly BridgesIslandStatus[];
  /** 絵の地に海を描くか。プレイ画面では画面全体の海の上に置くので描かず、遊び方の図とチュートリアルでは描く。 */
  showsSea?: boolean;
  guide?: BridgesFigureGuide | null;
  /** 2段階の操作で選んでいる島。 */
  selectedIsland?: number | null;
  /** キーボードで選んでいる島。輪で囲む。 */
  focusedIsland?: number | null;
  /** 交わる橋に阻まれたとき、阻んだ橋の辺。点ける線を描いておき、盤面の反応で短く点ける。 */
  blockingEdges?: readonly number[];
  /** 阻んだ橋の線を点けたまま描くか。遊び方の図で、阻まれたときの盤面の反応を見せるときに使う。 */
  showsBlockingEdges?: boolean;
  /** 2本の橋を外したばかりの辺。外す動きで縮める2枚の板を、見えない姿で描いておく。 */
  retractingEdge?: number | null;
  /** 全島がつながった盤面を灯すか。橋に沿った光と島の光を描く。 */
  lit?: boolean;
  ref?: Ref<SVGSVGElement>;
};

/** 演出が図の部品を探すための属性。 */
export const bridgesFigureParts = {
  island: "data-bridges-island",
  bridgeEdge: "data-bridges-edge",
  bridgePlank: "data-bridges-plank",
  retracting: "data-bridges-retracting",
  blockingBridges: "data-bridges-blocking",
  clearGlow: "data-bridges-clear-glow",
  clearIslandHalo: "data-bridges-clear-halo",
  ripple: "data-bridges-ripple",
} as const;

/** 図の寸法はマス幅を 1 とした値。 */
const SINGLE_PLANK_WIDTH = 0.24;
const DOUBLE_PLANK_WIDTH = 0.16;
const PLANK_RAIL_WIDTH = 0.04;
/** 板の継ぎ目の太さと間隔。 */
const PLANK_SEAM_DASH = "0.04 0.09";
/** 板と陸の影を落とす向き。光を左上から当て、右下へ落とす。 */
const SHADOW_OFFSET = { x: 0.025, y: 0.06 } as const;
const SHALLOWS_RADIUS = 0.53;
const ISLAND_INNER_RING_INSET = 0.07;
const ISLAND_INNER_RING_WIDTH = 0.035;
/** 阻んだ橋を点ける線の太さ。2本の橋の2枚の板を覆う太さにし、橋の上に重ねても見分けられるようにする。 */
const BLOCKING_LINE_WIDTH = 0.36;
const GUIDE_LINE_WIDTH = 0.06;
const GUIDE_PREVIEW_LINE_WIDTH = 0.13;
const GUIDE_CASING_EXTRA = 0.06;
const SELECTION_RING_RADIUS = ISLAND_RADIUS + 0.1;
const FOCUS_RING_RADIUS = ISLAND_RADIUS + 0.17;
const FOCUS_RING_WIDTH = 0.05;
const CLEAR_GLOW_HALO_WIDTH = 0.42;
const CLEAR_GLOW_CORE_WIDTH = 0.06;
const CLEAR_ISLAND_HALO_RADIUS = 0.66;
const RIPPLE_WIDTH = 0.18;
/** 数字の字の大きさ。島の陸の直径の6割ほどにする。 */
const CLUE_FONT_SIZE = 0.48;
/** 遊び方の図とチュートリアルで描く海の角の丸み。 */
const SEA_CORNER_RADIUS = 0.3;
/** 絵の中の海に散らす波の印の1区画。 */
const SEA_WAVE_TILE = { width: 2.4, height: 1.6 } as const;
const SEA_WAVE_SIZE = 0.36;
const SEA_WAVE_STROKE_WIDTH = 0.04;

function offsetSegment(
  { start, end }: BoardSegment,
  offset: number,
): BoardSegment {
  const horizontal = start.y === end.y;
  const shift = (point: BoardPoint) =>
    horizontal
      ? { x: point.x, y: point.y + offset }
      : { x: point.x + offset, y: point.y };
  return { start: shift(start), end: shift(end) };
}

function SegmentLine({
  segment: { start, end },
  className,
  strokeWidth,
  strokeDasharray,
  pathLength,
}: {
  segment: BoardSegment;
  className: string;
  strokeWidth: number;
  strokeDasharray?: string;
  pathLength?: number;
}) {
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      className={className}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      pathLength={pathLength}
    />
  );
}

/** 1枚の木の板。影、欄干の縁、板の面、継ぎ目の順に重ねる。 */
function BridgePlank({
  segment,
  width,
}: {
  segment: BoardSegment;
  width: number;
}) {
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
      <SegmentLine
        segment={shadow}
        className={bridgesToneClassNames.bridgeShadow}
        strokeWidth={width}
      />
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
      <SegmentLine
        segment={segment}
        className={bridgesToneClassNames.bridgeSeam}
        strokeWidth={deckWidth}
        strokeDasharray={PLANK_SEAM_DASH}
      />
    </>
  );
}

/** 辺の橋の板。本数ぶんの板を、辺の中心線から横へずらして並べる。 */
function BridgePlanks({
  segment,
  count,
}: {
  segment: BoardSegment;
  count: BridgeCount;
}) {
  const width = count === 2 ? DOUBLE_PLANK_WIDTH : SINGLE_PLANK_WIDTH;
  return getBridgeLineOffsets(count).map((offset, plank) => (
    <g key={offset} {...{ [bridgesFigureParts.bridgePlank]: plank }}>
      <BridgePlank segment={offsetSegment(segment, offset)} width={width} />
    </g>
  ));
}

function GuideLine({
  segment,
  strokeWidth,
}: {
  segment: BoardSegment;
  strokeWidth: number;
}) {
  return (
    <>
      <SegmentLine
        segment={segment}
        className={bridgesToneClassNames.guideCasing}
        strokeWidth={strokeWidth + GUIDE_CASING_EXTRA}
      />
      <SegmentLine
        segment={segment}
        className={bridgesToneClassNames.guide}
        strokeWidth={strokeWidth}
      />
    </>
  );
}

/** 遊び方の図とチュートリアルで、絵の地に敷く海。 */
function FigureSea({ view }: { view: BoardView }) {
  const patternId = useId();
  const half = SEA_WAVE_SIZE / 2;
  const wave = (x: number, y: number) =>
    `M${x} ${y}q${half / 2} ${-half / 2} ${half} 0t${half} 0`;
  return (
    <>
      <defs>
        <pattern
          id={patternId}
          width={SEA_WAVE_TILE.width}
          height={SEA_WAVE_TILE.height}
          patternUnits="userSpaceOnUse"
        >
          <g
            fill="none"
            strokeWidth={SEA_WAVE_STROKE_WIDTH}
            strokeLinecap="round"
            className={bridgesToneClassNames.seaWave}
          >
            <path d={wave(0.3, 0.45)} />
            <path d={wave(1.55, 1.25)} />
          </g>
        </pattern>
      </defs>
      <rect
        width={view.width}
        height={view.height}
        rx={SEA_CORNER_RADIUS}
        className={bridgesToneClassNames.seaFill}
      />
      <rect
        width={view.width}
        height={view.height}
        rx={SEA_CORNER_RADIUS}
        fill={`url(#${patternId})`}
      />
    </>
  );
}

/**
 * 盤面の絵。下から、海・海の波紋・浅瀬・橋の板・外す板・阻んだ橋の点灯・架けられる相手への線・島の光・島の陸と数字・
 * 選んだ島とキーボードの輪の順に重ねる。橋は島の中心から中心へ描き、端を島の陸で覆う。
 */
export function BridgesFigure({
  board,
  view = createBoardView(board),
  bridges,
  islandStatuses,
  showsSea = false,
  guide = null,
  selectedIsland = null,
  focusedIsland = null,
  blockingEdges = [],
  showsBlockingEdges = false,
  retractingEdge = null,
  lit = false,
  ref,
}: BridgesFigureProps) {
  const { edges } = getBridgesNetwork(board);
  const islandCenters = board.islands.map((island) =>
    toViewPoint(view, getIslandCenter(island)),
  );
  const depths = lit ? listClearWaveDepths(board, bridges) : [];

  function renderRing(
    island: number | null,
    radius: number,
    width: number,
    className: string,
  ) {
    if (island === null) {
      return null;
    }
    const { x, y } = islandCenters[island]!;
    return (
      <>
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="none"
          strokeWidth={width + GUIDE_CASING_EXTRA}
          className={bridgesToneClassNames.guideCasing}
        />
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="none"
          strokeWidth={width}
          className={className}
        />
      </>
    );
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${view.width} ${view.height}`}
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      {showsSea && <FigureSea view={view} />}
      <circle
        {...{ [bridgesFigureParts.ripple]: "" }}
        cx={view.width / 2}
        cy={view.height / 2}
        r={Math.hypot(view.width, view.height) / 2}
        fill="none"
        strokeWidth={RIPPLE_WIDTH}
        className={bridgesToneClassNames.seaRipple}
        opacity={0}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <g className={bridgesToneClassNames.shallows}>
        {islandCenters.map(({ x, y }) => (
          <circle key={`${x}:${y}`} cx={x} cy={y} r={SHALLOWS_RADIUS} />
        ))}
      </g>
      {edges.map(({ from, to }, edge) =>
        bridges[edge] === 0 ? null : (
          <g
            key={`${from}-${to}`}
            {...{ [bridgesFigureParts.bridgeEdge]: edge }}
          >
            <BridgePlanks
              segment={getEdgeViewSegment(view, edge)}
              count={bridges[edge]!}
            />
          </g>
        ),
      )}
      {retractingEdge !== null && (
        <g
          key={`retracting-${retractingEdge}`}
          {...{ [bridgesFigureParts.retracting]: retractingEdge }}
          opacity={0}
        >
          <BridgePlanks
            segment={getEdgeViewSegment(view, retractingEdge)}
            count={2}
          />
        </g>
      )}
      <g
        {...{ [bridgesFigureParts.blockingBridges]: "" }}
        className={bridgesToneClassNames.blockingBridge}
        strokeWidth={BLOCKING_LINE_WIDTH}
        strokeLinecap="round"
        opacity={showsBlockingEdges ? 0.85 : 0}
      >
        {blockingEdges.map((edge) => {
          const { start, end } = getEdgeViewSegment(view, edge);
          return (
            <line
              key={`blocking-${edge}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
            />
          );
        })}
      </g>
      {lit &&
        edges.map(({ from, to }, edge) => {
          if (bridges[edge] === 0) {
            return null;
          }
          const [source, target] =
            (depths[from] ?? 0) <= (depths[to] ?? 0) ? [from, to] : [to, from];
          const segment = {
            start: islandCenters[source]!,
            end: islandCenters[target]!,
          };
          return (
            <g
              key={`glow-${from}-${to}`}
              {...{ [bridgesFigureParts.clearGlow]: depths[source] ?? 0 }}
              strokeLinecap="round"
            >
              <SegmentLine
                segment={segment}
                className={bridgesToneClassNames.clearGlowHalo}
                strokeWidth={CLEAR_GLOW_HALO_WIDTH}
                strokeDasharray="1 1"
                pathLength={1}
              />
              <SegmentLine
                segment={segment}
                className={bridgesToneClassNames.clearGlowCore}
                strokeWidth={CLEAR_GLOW_CORE_WIDTH}
                strokeDasharray="1 1"
                pathLength={1}
              />
            </g>
          );
        })}
      {guide && (
        <g strokeLinecap="round">
          {guide.edges.map((edge) => (
            <GuideLine
              key={`guide-${edge}`}
              segment={getEdgeViewSegment(view, edge)}
              strokeWidth={
                edge === guide.previewEdge
                  ? GUIDE_PREVIEW_LINE_WIDTH
                  : GUIDE_LINE_WIDTH
              }
            />
          ))}
        </g>
      )}
      {lit &&
        islandCenters.map(({ x, y }, island) => (
          <circle
            key={`halo-${x}:${y}`}
            {...{ [bridgesFigureParts.clearIslandHalo]: depths[island] ?? 0 }}
            cx={x}
            cy={y}
            r={CLEAR_ISLAND_HALO_RADIUS}
            className={bridgesToneClassNames.clearIslandHalo}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        ))}
      {board.islands.map((island, index) => {
        const { x, y } = islandCenters[index]!;
        const tone = bridgesIslandTones[islandStatuses[index]!];
        return (
          <g
            key={`${island.row}:${island.column}`}
            {...{ [bridgesFigureParts.island]: index }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <circle
              cx={x + SHADOW_OFFSET.x}
              cy={y + SHADOW_OFFSET.y}
              r={ISLAND_RADIUS}
              className={bridgesToneClassNames.islandShadow}
            />
            <circle
              cx={x}
              cy={y}
              r={ISLAND_RADIUS - tone.rimWidth / 2}
              strokeWidth={tone.rimWidth}
              strokeDasharray={tone.rimDash}
              className={cn(tone.land, tone.rim)}
            />
            {tone.innerRing && (
              <circle
                cx={x}
                cy={y}
                r={ISLAND_RADIUS - tone.rimWidth - ISLAND_INNER_RING_INSET}
                fill="none"
                strokeWidth={ISLAND_INNER_RING_WIDTH}
                className={tone.innerRing}
              />
            )}
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
      {renderRing(
        selectedIsland,
        SELECTION_RING_RADIUS,
        GUIDE_PREVIEW_LINE_WIDTH,
        bridgesToneClassNames.guide,
      )}
      {renderRing(
        focusedIsland,
        FOCUS_RING_RADIUS,
        FOCUS_RING_WIDTH,
        bridgesToneClassNames.focusRing,
      )}
    </svg>
  );
}
