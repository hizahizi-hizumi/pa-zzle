import type { Ref } from "react";
import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { BlockedAttempt } from "@/games/bridges/ui/board/BridgesFigure/BlockedAttempt";
import { BridgePlanks } from "@/games/bridges/ui/board/BridgesFigure/BridgePlanks";
import { BridgePosts } from "@/games/bridges/ui/board/BridgesFigure/BridgePosts";
import { FigureSea } from "@/games/bridges/ui/board/BridgesFigure/FigureSea";
import {
  BLOCKING_CASING_SIDE,
  BLOCKING_OUTLINE_SIDE,
  bridgesFigureParts,
  CLUE_BASELINE_OFFSET,
  CLUE_FONT_SIZE,
  FOCUS_RING_RADIUS,
  FOCUS_RING_WIDTH,
  FOCUS_VEIL_OPACITY,
  HOVER_GHOST_OPACITY,
  ISLAND_OUTLINE_WIDTH,
  OVER_RIM_DASH,
  OVER_RIM_RADIUS,
  OVER_RIM_WIDTH,
  PREVIEW_ROPE_WIDTH,
  ROPE_CASING_EXTRA,
  ROPE_WIDTH,
  SELECTION_RING_RADIUS,
  TARGET_RING_RADIUS,
  TARGET_RING_WIDTH,
  UNFOCUSED_OPACITY,
  UNFOCUSED_ROPE_OPACITY,
} from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
import type {
  BridgesBlockedAttempt,
  BridgesFigureGuide,
  LitDeckWave,
} from "@/games/bridges/ui/board/BridgesFigure/figure-contract";
import {
  getBlockedAttemptSegment,
  getFootprintHalfWidth,
  plankLayouts,
} from "@/games/bridges/ui/board/BridgesFigure/figure-layout";
import { GhostBridge } from "@/games/bridges/ui/board/BridgesFigure/GhostBridge";
import { GridDots } from "@/games/bridges/ui/board/BridgesFigure/GridDots";
import { GuideBands } from "@/games/bridges/ui/board/BridgesFigure/GuideBands";
import { Rope } from "@/games/bridges/ui/board/BridgesFigure/Rope";
import { SegmentLine } from "@/games/bridges/ui/board/BridgesFigure/SegmentLine";
import type { BridgesBoardSpotlight } from "@/games/bridges/ui/board/board-cue";
import {
  type BoardView,
  createBoardView,
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

export { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure/figure-appearance";
export type {
  BridgesBlockedAttempt,
  BridgesFigureGuide,
} from "@/games/bridges/ui/board/BridgesFigure/figure-contract";
export { getGhostBridgeWidth } from "@/games/bridges/ui/board/BridgesFigure/figure-layout";

type BridgesFigureProps = {
  board: BridgesBoard;
  view?: BoardView;
  bridges: readonly BridgeCount[];
  islandStatuses: readonly BridgesIslandStatus[];
  /** プレイ画面では画面全体の海の上に置くので描かず、遊び方の図とチュートリアルでは描く。 */
  showsSea?: boolean;
  guide?: BridgesFigureGuide | null;
  /** マウスを乗せた所で押せば回る辺。架かった後の板の影を淡く予告する。 */
  hoverEdge?: number | null;
  /** 最も近い2本の線までの距離がほとんど同じ所を押した（マウスを乗せた）ときの、候補の2辺。 */
  candidateEdges?: readonly number[] | null;
  /** 押している指が今離せば回す辺。 */
  pressedEdge?: number | null;
  pressedIsland?: number | null;
  /**
   * 島を触っていなくても、架けられる相手までの帯を敷く辺。チュートリアルで押させる辺に敷き、本番の案内と同じ表し方で見せる。
   */
  bandEdges?: readonly number[];
  /**
   * チュートリアルで手を引いている間に、元の明るさで見せる島と辺。海を深い海の色で暗くし、ほかの島と橋を薄くして沈める。
   */
  focus?: BridgesBoardSpotlight | null;
  /** 2段階の操作で選んでいる島。 */
  selectedIsland?: number | null;
  /** キーボードで選んでいる島。 */
  focusedIsland?: number | null;
  /** 交わる橋に阻まれたとき、阻んだ橋の辺。板の薔薇色の縁取りを描いておき、盤面の反応で短く点けて揺らす。 */
  blockingEdges?: readonly number[];
  /**
   * 交わる橋に阻まれたとき、押した辺と、板を伸ばし始める島。押した島から阻んだ橋の手前までの板を描いておき、盤面の反応で
   * 伸ばして突き当て、弾き返す。
   */
  blockedAttempt?: BridgesBlockedAttempt | null;
  /** 阻んだ橋の縁取りと押した辺の板の影を点けたまま描くか。遊び方の図で、阻まれたときの盤面の反応を見せるときに使う。 */
  showsBlockingEdges?: boolean;
  /** 2本の橋を外したばかりの辺。外す動きで縮める2枚の板を、見えない姿で描いておく。 */
  retractingEdge?: number | null;
  /** 全島がつながった盤面か。架かった橋の板に、明るい木の色の面を重ねて描く。 */
  lit?: boolean;
  /** 明るい木の色を渡し始める、最後に架けた橋の辺。無ければ島0 から渡す。 */
  clearOriginEdge?: number | null;
  /**
   * マスが小さい盤面か（スマホの 9×9 以上ほど）。板の横木の刻みを省いて板を太くし、2本の板の間を広げて、
   * 1本と2本を形で見分けられる幅を保つ。
   */
  compact?: boolean;
  ref?: Ref<SVGSVGElement>;
};

const centerOrigin = {
  transformBox: "fill-box",
  transformOrigin: "center",
} as const;

/**
 * 下から、海・マスの中心の点・架けられる相手までの帯・板の予告・
 * 阻まれた辺の板・橋（阻んだ橋の縁取り、板、明るい木の色の板、杭）・外す板・ロープ・交点の候補のロープ・島（平らな真円の塗りと輪郭線）と数字・
 * 選んだ島とキーボードの輪の順に重ねる。
 * 阻まれた辺の板の影は橋の下に置き、阻んだ橋がその上を渡って見えるようにする。
 * 橋は島の中心から中心へ描き、端を島で覆う。
 */
export function BridgesFigure({
  board,
  view = createBoardView(board),
  bridges,
  islandStatuses,
  showsSea = false,
  guide = null,
  hoverEdge = null,
  candidateEdges = null,
  pressedEdge = null,
  pressedIsland = null,
  bandEdges = [],
  focus = null,
  selectedIsland = null,
  focusedIsland = null,
  blockingEdges = [],
  blockedAttempt = null,
  showsBlockingEdges = false,
  retractingEdge = null,
  lit = false,
  clearOriginEdge = null,
  compact = false,
  ref,
}: BridgesFigureProps) {
  const layout = compact ? plankLayouts.compact : plankLayouts.regular;
  const { edges } = getBridgesNetwork(board);
  const islandCenters = board.islands.map((island) =>
    toViewPoint(view, getIslandCenter(island)),
  );
  const depths = lit
    ? listClearWaveDepths(board, bridges, clearOriginEdge)
    : [];
  function getLitDeckWave(from: number, to: number): LitDeckWave | null {
    const fromDepth = depths[from] ?? null;
    const toDepth = depths[to] ?? null;
    if (fromDepth === null || toDepth === null) {
      return null;
    }
    if (fromDepth === toDepth) {
      return { depth: fromDepth, origin: null };
    }
    return fromDepth < toDepth
      ? { depth: fromDepth, origin: islandCenters[from]! }
      : { depth: toDepth, origin: islandCenters[to]! };
  }
  const previewEdge = guide?.previewEdge ?? null;
  // 阻まれる辺には架かった後の姿を見せず、ロープだけで押した辺を示す。
  const pressedGhostEdge =
    pressedEdge !== null &&
    (bridges[pressedEdge] !== 0 ||
      !getBridgesNetwork(board).crossingEdges[pressedEdge]!.some(
        (crossing) => bridges[crossing] !== 0,
      ))
      ? pressedEdge
      : null;
  const ghostEdge =
    previewEdge ?? (pressedEdge === null ? hoverEdge : pressedGhostEdge);
  const ghostOpacity =
    previewEdge === null && pressedEdge === null ? HOVER_GHOST_OPACITY : 1;
  const targetIsland =
    guide === null || previewEdge === null
      ? null
      : edges[previewEdge]!.from === guide.island
        ? edges[previewEdge]!.to
        : edges[previewEdge]!.from;

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
          strokeWidth={width + ROPE_CASING_EXTRA}
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
      // 海を描かない絵は画面全体の海の上に置くので、弾んだ島を絵の外まで描く。
      overflow={showsSea ? "hidden" : "visible"}
      aria-hidden="true"
    >
      {showsSea && <FigureSea view={view} />}
      {focus && (
        <rect
          width={view.width}
          height={view.height}
          className={bridgesToneClassNames.focusVeil}
          opacity={FOCUS_VEIL_OPACITY}
        />
      )}
      <GridDots view={view} />
      {(guide || bandEdges.length > 0) && (
        <GuideBands
          view={view}
          edges={[...new Set([...(guide?.edges ?? []), ...bandEdges])]}
        />
      )}
      {ghostEdge !== null && bridges[ghostEdge] !== 2 && (
        <GhostBridge
          segment={getEdgeViewSegment(view, ghostEdge)}
          current={bridges[ghostEdge]!}
          layout={layout}
          opacity={ghostOpacity}
        />
      )}
      {blockedAttempt !== null && bridges[blockedAttempt.edge] === 0 && (
        <BlockedAttempt
          segment={getBlockedAttemptSegment(
            view,
            blockedAttempt,
            blockingEdges,
            bridges,
            layout,
          )}
          layout={layout}
          opacity={showsBlockingEdges ? 1 : 0}
        />
      )}
      {edges.map(({ from, to, orientation }, edge) => {
        const count = bridges[edge]!;
        if (count === 0) {
          return null;
        }
        const segment = getEdgeViewSegment(view, edge);
        return (
          <g
            key={`${from}-${to}`}
            {...{
              [bridgesFigureParts.bridgeEdge]: edge,
              [bridgesFigureParts.bridgeAxis]:
                orientation === "horizontal" ? "y" : "x",
            }}
            opacity={
              focus && !focus.edges.includes(edge)
                ? UNFOCUSED_OPACITY
                : undefined
            }
          >
            {blockingEdges.includes(edge) && (
              <g
                {...{ [bridgesFigureParts.blockingOutline]: edge }}
                opacity={showsBlockingEdges ? 1 : 0}
                strokeLinecap="round"
              >
                <SegmentLine
                  segment={segment}
                  className={bridgesToneClassNames.blockingCasing}
                  strokeWidth={
                    (getFootprintHalfWidth(count, layout) +
                      BLOCKING_OUTLINE_SIDE +
                      BLOCKING_CASING_SIDE) *
                    2
                  }
                />
                <SegmentLine
                  segment={segment}
                  className={bridgesToneClassNames.blockingBridge}
                  strokeWidth={
                    (getFootprintHalfWidth(count, layout) +
                      BLOCKING_OUTLINE_SIDE) *
                    2
                  }
                />
              </g>
            )}
            <BridgePlanks
              segment={segment}
              count={count}
              layout={layout}
              litWave={lit ? getLitDeckWave(from, to) : null}
            />
            <BridgePosts segment={segment} count={count} layout={layout} />
          </g>
        );
      })}
      {retractingEdge !== null && (
        <g
          key={`retracting-${retractingEdge}`}
          {...{ [bridgesFigureParts.retracting]: retractingEdge }}
          opacity={0}
        >
          <BridgePlanks
            segment={getEdgeViewSegment(view, retractingEdge)}
            count={2}
            layout={layout}
          />
        </g>
      )}
      {ghostEdge !== null && bridges[ghostEdge] === 2 && (
        <GhostBridge
          segment={getEdgeViewSegment(view, ghostEdge)}
          current={2}
          layout={layout}
          opacity={ghostOpacity}
        />
      )}
      {guide && (
        <g strokeLinecap="round">
          {guide.edges.map((edge) => {
            const previewing = edge === guide.previewEdge;
            return (
              <Rope
                key={`guide-${edge}`}
                edge={edge}
                segment={getEdgeViewSegment(view, edge)}
                strokeWidth={previewing ? PREVIEW_ROPE_WIDTH : ROPE_WIDTH}
                dashed={!previewing}
                opacity={
                  guide.aimEdge !== null && edge !== guide.aimEdge
                    ? UNFOCUSED_ROPE_OPACITY
                    : 1
                }
              />
            );
          })}
        </g>
      )}
      {pressedEdge !== null && (
        <g
          strokeLinecap="round"
          {...{ [bridgesFigureParts.pressedEdge]: pressedEdge }}
        >
          <Rope
            edge={pressedEdge}
            segment={getEdgeViewSegment(view, pressedEdge)}
            strokeWidth={PREVIEW_ROPE_WIDTH}
            dashed={false}
            opacity={1}
          />
        </g>
      )}
      {candidateEdges && (
        <g
          strokeLinecap="round"
          {...{ [bridgesFigureParts.candidateHint]: "" }}
        >
          {candidateEdges.map((edge) => (
            <Rope
              key={`crossing-${edge}`}
              edge={edge}
              segment={getEdgeViewSegment(view, edge)}
              strokeWidth={ROPE_WIDTH}
              dashed
              opacity={1}
            />
          ))}
        </g>
      )}
      {board.islands.map((island, index) => {
        const center = islandCenters[index]!;
        const tone = bridgesIslandTones[islandStatuses[index]!];
        return (
          <g
            key={`${island.row}:${island.column}`}
            {...{ [bridgesFigureParts.island]: index }}
            style={centerOrigin}
            opacity={
              focus && !focus.islands.includes(index)
                ? UNFOCUSED_OPACITY
                : undefined
            }
          >
            <circle
              cx={center.x}
              cy={center.y}
              r={ISLAND_RADIUS}
              strokeWidth={ISLAND_OUTLINE_WIDTH}
              className={cn(tone.land, tone.outline)}
            />
            {tone.rim && (
              <circle
                cx={center.x}
                cy={center.y}
                r={OVER_RIM_RADIUS}
                fill="none"
                strokeWidth={OVER_RIM_WIDTH}
                strokeDasharray={OVER_RIM_DASH}
                className={tone.rim}
              />
            )}
            <text
              x={center.x}
              y={center.y + CLUE_FONT_SIZE * CLUE_BASELINE_OFFSET}
              textAnchor="middle"
              fontSize={CLUE_FONT_SIZE}
              fontWeight={700}
              className={cn("select-none font-sans tabular-nums", tone.clue)}
            >
              {island.clue}
            </text>
          </g>
        );
      })}
      {renderRing(
        selectedIsland,
        SELECTION_RING_RADIUS,
        PREVIEW_ROPE_WIDTH,
        bridgesToneClassNames.guide,
      )}
      {pressedIsland !== selectedIsland &&
        renderRing(
          pressedIsland,
          SELECTION_RING_RADIUS,
          PREVIEW_ROPE_WIDTH,
          bridgesToneClassNames.guide,
        )}
      {renderRing(
        targetIsland,
        TARGET_RING_RADIUS,
        TARGET_RING_WIDTH,
        bridgesToneClassNames.guide,
      )}
      {renderRing(
        focusedIsland,
        FOCUS_RING_RADIUS,
        FOCUS_RING_WIDTH,
        bridgesToneClassNames.guide,
      )}
    </svg>
  );
}
