import type { Ref } from "react";

import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import type { BridgesBoardSpotlight } from "@/games/bridges/ui/board/board-cue";
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
import { SeaWaves } from "@/games/bridges/ui/SeaWaves";
import { cn } from "@/lib/utils";

/**
 * - `edges`: ロープを張る辺。交わる橋に阻まれて今は架けられない辺は含めない。
 * - `aimEdge`: なぞる指が向いている辺。決まらなければ `null`。ほかのロープを淡くし、この辺のロープを目立たせる。
 * - `previewEdge`: 今離せば橋を回す辺。`aimEdge` の相手の島に指が届いたときだけ持つ。決まらなければ `null`。
 */
export type BridgesFigureGuide = {
  island: number;
  edges: readonly number[];
  aimEdge: number | null;
  previewEdge: number | null;
};

/** 交わる橋に阻まれた操作。`edge` は押した辺、`island` は板を伸ばし始める端の島。 */
export type BridgesBlockedAttempt = { edge: number; island: number };

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

/** 演出が図の部品を探すための属性。明るい木の色の板の値は、その板へ光が渡り始める段数。 */
export const bridgesFigureParts = {
  island: "data-bridges-island",
  bridgeEdge: "data-bridges-edge",
  bridgePlank: "data-bridges-plank",
  plankShadow: "data-bridges-plank-shadow",
  retracting: "data-bridges-retracting",
  bridgeAxis: "data-bridges-edge-axis",
  blockingOutline: "data-bridges-blocking",
  blockedAttempt: "data-bridges-blocked-attempt",
  litDeck: "data-bridges-lit-deck",
  rope: "data-bridges-rope",
  candidateHint: "data-bridges-candidate-hint",
  pressedEdge: "data-bridges-pressed-edge",
} as const;

/**
 * 板の寸法。図の寸法はマス幅を 1 とした値。
 * - `single`・`double`: 1本・2本の橋の板1枚の幅。
 * - `spacing`: 2本の橋の2枚の板の中心どうしの間隔。
 */
type PlankLayout = {
  single: number;
  double: number;
  spacing: number;
  seams: boolean;
};

/**
 * マスの大きい盤面の板と、マスの小さい盤面（`compact`）の板。マスの小さい盤面では横木が点の並びにつぶれるので刻まず、
 * その分だけ板を太くし、2本の板の間の海も広げる。どちらも寸法はマス幅に比例する。
 */
const plankLayouts = {
  regular: { single: 0.26, double: 0.18, spacing: 0.3, seams: true },
  compact: { single: 0.3, double: 0.2, spacing: 0.34, seams: false },
} as const satisfies Record<string, PlankLayout>;

const PLANK_RAIL_WIDTH = 0.035;
/** 板の横木の太さと間隔。板の幅ほどの間を空けて間引き、梯子や線路の枕木に見せない。 */
const PLANK_SEAM_DASH = "0.025 0.155";
/** 板の影を落とす向き。光を左上から当て、右下へ落とす。 */
const SHADOW_OFFSET = { x: 0.02, y: 0.045 } as const;
/** 杭の半径と、島の中心から杭までの距離。杭は島の輪郭線のすぐ外に立て、10×10 のスマホでも点でなく杭に見える太さにする。 */
const POST_RADIUS = 0.065;
const POST_DISTANCE = ISLAND_RADIUS + 0.1;
const GUIDE_BAND_WIDTH = 0.56;
const GRID_DOT_RADIUS = 0.05;
/**
 * 島の輪郭線の太さ。10×10 のスマホでも 2px ほどの線にし、塗りが海や橋と近い明るさになる状態でも島の縁を切り出す。
 */
const ISLAND_OUTLINE_WIDTH = 0.06;
const OVER_RIM_RADIUS = ISLAND_RADIUS - 0.07;
const OVER_RIM_WIDTH = 0.07;
const OVER_RIM_DASH = "0.12 0.07";
/** 阻んだ橋の板の外側に、片側に見せる薔薇色の縁取りの幅と、その外の白い縁の幅。 */
const BLOCKING_OUTLINE_SIDE = 0.12;
const BLOCKING_CASING_SIDE = 0.03;
const ROPE_WIDTH = 0.12;
const ROPE_DASH = "0.15 0.07";
const PREVIEW_ROPE_WIDTH = 0.12;
/** 板の影を、板より少し太く描く分。ロープを上に重ねても、ロープの両脇に影が見える。 */
const GHOST_EXTRA_WIDTH = 0.08;
const ROPE_CASING_EXTRA = 0.07;
const REMOVAL_EXTRA_WIDTH = 0.04;
/** なぞっている間、指の向いた辺のほかのロープの濃さ。 */
const UNFOCUSED_ROPE_OPACITY = 0.35;
const HOVER_GHOST_OPACITY = 0.6;
const SELECTION_RING_RADIUS = ISLAND_RADIUS + 0.1;
/** 離せば回す辺の相手の島を囲む輪。指で隠れても輪の外側が見える大きさにする。 */
const TARGET_RING_RADIUS = ISLAND_RADIUS + 0.16;
const TARGET_RING_WIDTH = 0.09;
const FOCUS_RING_RADIUS = ISLAND_RADIUS + 0.17;
const FOCUS_RING_WIDTH = 0.05;
const FOCUS_VEIL_OPACITY = 0.38;
const UNFOCUSED_OPACITY = 0.4;
/** 阻まれた辺に架かるはずだった板の濃さ。板そのものを透かし、下の海が見える濃さにする。 */
const BLOCKED_ATTEMPT_OPACITY = 0.5;

/**
 * 数字の字の大きさ。島の直径の6割ほどにし、10×10 のスマホで 20px ほど（ナンプレの盤面の数字と同じ大きさ）にする。
 */
const CLUE_FONT_SIZE = 0.55;
/**
 * 数字を島の中心にそろえる、文字の大きさに対する基線の下げ幅。iOS の Safari は小さな文字の
 * dominant-baseline="central" を上へずらして描くので使わず、数字の高さ（約 0.72em）の半分だけ基線を下げる。
 */
const CLUE_BASELINE_OFFSET = 0.36;
/** 絵の中の海の波の印の、区画の寸法に掛ける倍率。マス幅の 1/40 を 1 とする。 */
const FIGURE_WAVE_UNIT = 1 / 40;

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
  ...attributes
}: {
  segment: BoardSegment;
  className: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity?: number;
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
      {...attributes}
    />
  );
}

function getPlankWidth(count: BridgeCount, layout: PlankLayout): number {
  return count === 2 ? layout.double : layout.single;
}

function getPlankOffsets(
  count: BridgeCount,
  layout: PlankLayout,
): readonly number[] {
  return getBridgeLineOffsets(count, layout.spacing);
}

function getFootprintHalfWidth(
  count: BridgeCount,
  layout: PlankLayout,
): number {
  const offsets = getPlankOffsets(count, layout);
  return Math.max(...offsets.map(Math.abs)) + getPlankWidth(count, layout) / 2;
}

/** 両端の島ごとに、板の外側の左右に1本ずつ立てる。 */
function listPostPoints(
  { start, end }: BoardSegment,
  count: BridgeCount,
  layout: PlankLayout,
): BoardPoint[] {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const along = {
    x: (end.x - start.x) / length,
    y: (end.y - start.y) / length,
  };
  const across = { x: -along.y, y: along.x };
  const side = getFootprintHalfWidth(count, layout) + POST_RADIUS * 0.4;
  return ([0, 1] as const).flatMap((endIndex) => {
    const [origin, direction] = endIndex === 0 ? [start, 1] : [end, -1];
    const base = {
      x: origin.x + along.x * POST_DISTANCE * direction,
      y: origin.y + along.y * POST_DISTANCE * direction,
    };
    return [-1, 1].map((sign) => ({
      x: base.x + across.x * side * sign,
      y: base.y + across.y * side * sign,
    }));
  });
}

/**
 * 全島がつながった盤面で、板に重ねる明るい木の色の面の渡り方。
 * - `depth`: その板へ光が渡り始める段数。
 * - `origin`: 光が渡り始める島の中心。段の違う島を結ぶ板は、段の浅い島から相手の島へ伸ばす。
 *   同じ段の島を結ぶ板（最後に架けた橋など）は `null` にし、伸ばさずに浮かび上がらせる。
 */
type LitDeckWave = {
  depth: number;
  origin: BoardPoint | null;
};

/**
 * `litWave` を渡すと、全島がつながった盤面の明るい木の色の面を、板の面と横木の間に重ねる。渡り切った姿で描き、
 * 演出がその姿へ向けて光を渡す。
 */
function BridgePlank({
  segment,
  width,
  seams,
  litWave = null,
}: {
  segment: BoardSegment;
  width: number;
  seams: boolean;
  litWave?: LitDeckWave | null;
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

function BridgePlanks({
  segment,
  count,
  layout,
  litWave = null,
}: {
  segment: BoardSegment;
  count: BridgeCount;
  layout: PlankLayout;
  litWave?: LitDeckWave | null;
}) {
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

function BridgePosts({
  segment,
  count,
  layout,
}: {
  segment: BoardSegment;
  count: BridgeCount;
  layout: PlankLayout;
}) {
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

/** 辺の橋を回した後の姿の予告が占める幅。チュートリアルの印を、予告の板の影に沿わせるのに使う。 */
export function getGhostBridgeWidth(
  current: BridgeCount,
  compact = false,
): number {
  const layout = compact ? plankLayouts.compact : plankLayouts.regular;
  const next = ((current + 1) % 3) as BridgeCount;
  return next === 0
    ? getFootprintHalfWidth(current, layout) * 2 + REMOVAL_EXTRA_WIDTH
    : getFootprintHalfWidth(next, layout) * 2 + GHOST_EXTRA_WIDTH;
}

function GhostBridge({
  segment,
  current,
  layout,
  opacity = 1,
}: {
  segment: BoardSegment;
  current: BridgeCount;
  layout: PlankLayout;
  opacity?: number;
}) {
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

/** `opacity` は盤面の反応で一瞬だけ点けるための濃さで、点いたときも板は半透明のままにする。 */
function BlockedAttempt({
  segment,
  layout,
  opacity,
}: {
  segment: BoardSegment;
  layout: PlankLayout;
  opacity: number;
}) {
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

/**
 * 阻まれた辺の、押した端の島の中心から、その島に最も近い阻んだ橋の板の手前までの線分。
 * 阻んだ橋が無ければ、辺の全体。
 */
function getBlockedAttemptSegment(
  view: BoardView,
  { edge, island }: BridgesBlockedAttempt,
  blockingEdges: readonly number[],
  bridges: readonly BridgeCount[],
  layout: PlankLayout,
): BoardSegment {
  const whole = getEdgeViewSegment(view, edge);
  const { from } = getBridgesNetwork(view.board).edges[edge]!;
  const [start, far] =
    island === from ? [whole.start, whole.end] : [whole.end, whole.start];
  const horizontal = start.y === far.y;
  const direction = Math.sign(horizontal ? far.x - start.x : far.y - start.y);
  const stops = blockingEdges.map((blocking) => {
    const line = getEdgeViewSegment(view, blocking).start;
    const position = horizontal ? line.x : line.y;
    return (
      position -
      direction * getFootprintHalfWidth(bridges[blocking] || 1, layout)
    );
  });
  const origin = horizontal ? start.x : start.y;
  const stop =
    stops.length === 0
      ? horizontal
        ? far.x
        : far.y
      : stops.reduce((nearest, position) =>
          Math.abs(position - origin) < Math.abs(nearest - origin)
            ? position
            : nearest,
        );
  return {
    start,
    end: horizontal ? { x: stop, y: start.y } : { x: start.x, y: stop },
  };
}

/** どの相手へ架けられるかを、ロープより広い面で示す。 */
function GuideBands({
  view,
  edges,
}: {
  view: BoardView;
  edges: readonly number[];
}) {
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

function GridDots({ view }: { view: BoardView }) {
  const { board } = view;
  const occupied = new Set(
    board.islands.map(({ row, column }) => row * board.width + column),
  );
  const dots: BoardPoint[] = [];
  for (let row = 0; row < board.height; row += 1) {
    for (let column = 0; column < board.width; column += 1) {
      if (!occupied.has(row * board.width + column)) {
        dots.push(toViewPoint(view, { x: column + 0.5, y: row + 0.5 }));
      }
    }
  }
  return (
    <g className={bridgesToneClassNames.gridDot}>
      {dots.map(({ x, y }) => (
        <circle key={`${x}:${y}`} cx={x} cy={y} r={GRID_DOT_RADIUS} />
      ))}
    </g>
  );
}

function Rope({
  edge,
  segment,
  strokeWidth,
  dashed,
  opacity,
}: {
  edge: number;
  segment: BoardSegment;
  strokeWidth: number;
  dashed: boolean;
  opacity: number;
}) {
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

function FigureSea({ view }: { view: BoardView }) {
  return (
    <>
      <rect
        width={view.width}
        height={view.height}
        className={bridgesToneClassNames.seaFill}
      />
      <svg width={view.width} height={view.height} overflow="hidden">
        <SeaWaves unit={FIGURE_WAVE_UNIT} />
      </svg>
    </>
  );
}

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
