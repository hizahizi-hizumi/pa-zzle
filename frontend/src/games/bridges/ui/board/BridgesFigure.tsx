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
import { getIslandOutlinePath } from "@/games/bridges/ui/board/island-shape";
import {
  bridgesIslandTones,
  bridgesToneClassNames,
} from "@/games/bridges/ui/bridges-tone";
import { SeaWaves } from "@/games/bridges/ui/SeaWaves";
import { cn } from "@/lib/utils";

/**
 * 島から架けられる相手へ張るロープと、島と同じ行と列の淡い帯。島を押している間、島を選んでいる間、マウスを島に乗せている間に見せる。
 * - `island`: ロープを張る元の島。
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
  /** 絵の座標。省略すると、盤面から作る。 */
  view?: BoardView;
  /** 辺ごとの橋の本数。 */
  bridges: readonly BridgeCount[];
  /** 島ごとの、橋の本数と数字の比べ。 */
  islandStatuses: readonly BridgesIslandStatus[];
  /** 絵の地に海を描くか。プレイ画面では画面全体の海の上に置くので描かず、遊び方の図とチュートリアルでは描く。 */
  showsSea?: boolean;
  guide?: BridgesFigureGuide | null;
  /** マウスを乗せた所で押せば回る辺。架かった後の板の影を淡く予告する。 */
  hoverEdge?: number | null;
  /**
   * 最も近い2本の線までの距離がほとんど同じ所を押した（マウスを乗せた）ときの、候補の2辺。どちらの辺かを位置で決めないので、
   * 2辺にロープを張って、島から架ければどちらも選べることを示す。
   */
  candidateEdges?: readonly number[] | null;
  /** 押している指が今離せば回す辺。回した後の板の影と、張ったロープで光らせる。 */
  pressedEdge?: number | null;
  /** 押している島。選んだ島と同じ輪で囲む。 */
  pressedIsland?: number | null;
  /**
   * 島を触っていなくても、架けられる相手までの帯を敷く辺。チュートリアルで覆いから抜いた辺に敷き、本番の案内と同じ表し方で見せる。
   */
  bandEdges?: readonly number[];
  /** 2段階の操作で選んでいる島。 */
  selectedIsland?: number | null;
  /** キーボードで選んでいる島。輪で囲む。 */
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
  /** 全島がつながった盤面を灯すか。島の灯り、杭の灯り、明るい木の色の板、波紋、島の周りの澄んだ浅瀬を描く。 */
  lit?: boolean;
  /**
   * マスが小さい盤面か（スマホの 9×9 以上ほど）。板の横木の刻みを省いて板を太くし、2本の板の間を広げて、
   * 1本と2本を形で見分けられる幅を保つ。
   */
  compact?: boolean;
  ref?: Ref<SVGSVGElement>;
};

/** 演出が図の部品を探すための属性。灯りの部品の値は、その島が灯る段数。 */
export const bridgesFigureParts = {
  island: "data-bridges-island",
  bridgeEdge: "data-bridges-edge",
  bridgePlank: "data-bridges-plank",
  plankShadow: "data-bridges-plank-shadow",
  retracting: "data-bridges-retracting",
  bridgeAxis: "data-bridges-edge-axis",
  blockingOutline: "data-bridges-blocking",
  blockedAttempt: "data-bridges-blocked-attempt",
  lantern: "data-bridges-lantern",
  litShallows: "data-bridges-lit-shallows",
  litDeck: "data-bridges-lit-deck",
  lanternPost: "data-bridges-lantern-post",
  ripple: "data-bridges-ripple",
  rope: "data-bridges-rope",
  candidateHint: "data-bridges-candidate-hint",
  pressedEdge: "data-bridges-pressed-edge",
} as const;

/**
 * 板の寸法。図の寸法はマス幅を 1 とした値。
 * - `single`・`double`: 1本・2本の橋の板1枚の幅。
 * - `spacing`: 2本の橋の2枚の板の中心どうしの間隔。
 * - `seams`: 板に横木を刻むか。
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
/** 杭の半径と、島の中心から杭までの距離。杭は陸の縁の外の浅瀬に立て、10×10 のスマホでも点でなく杭に見える太さにする。 */
const POST_RADIUS = 0.065;
const POST_DISTANCE = ISLAND_RADIUS + 0.1;
/** 浅瀬が海の色へ消えるまでの、島の中心からの距離。陸の縁から波打ち際の外までの狭い帯にし、隣の島の浅瀬と重ねない。 */
const SHALLOWS_RADIUS = 0.62;
/** 灯った島の周りの澄んだ浅瀬が海の色へ消えるまでの、島の中心からの距離。波打ち際の外に、灯りより広く澄んだ水を見せる。 */
const LIT_SHALLOWS_RADIUS = 0.78;
/** 島を触っている間に、架けられる相手までの区間に敷く帯の太さ。 */
const GUIDE_BAND_WIDTH = 0.56;
/** マスの中心の、島の無い所に打つ点の半径。 */
const GRID_DOT_RADIUS = 0.03;
/** 波打ち際の白い線の、陸の輪郭に対する倍率と太さ。 */
const SURF_SCALE = 1.14;
const SURF_WIDTH = 0.03;
/** 陸の縁の濡れた砂の太さ。 */
const WET_SAND_WIDTH = 0.05;
/** 多すぎの島の、途切れた縁の太さ。 */
const OVER_RIM_WIDTH = 0.085;
/**
 * ちょうどの島の草地の、陸の輪郭に対する倍率。10×10 のスマホ（陸の直径 32px ほど）で草地を直径 22px ほどにし、数字を草地の中に
 * 収めながら、草地の周りに砂の陸が見える幅を残す。
 */
const GRASS_SCALE = 0.68;
/** 阻んだ橋の板の外側に見せる、薔薇色の縁取りの幅。多すぎの島の縁より細くする。 */
const BLOCKING_OUTLINE_EXTRA = 0.08;
/** ロープの太さと撚りの切れ目、縁の太さ。 */
const ROPE_WIDTH = 0.12;
const ROPE_DASH = "0.15 0.07";
const PREVIEW_ROPE_WIDTH = 0.12;
/** 板の影を、板より少し太く描く分。ロープを上に重ねても、ロープの両脇に影が見える。 */
const GHOST_EXTRA_WIDTH = 0.08;
const ROPE_CASING_EXTRA = 0.07;
/** 外れる板に重ねる海の色の覆いを、板より少し太く描く分。 */
const REMOVAL_EXTRA_WIDTH = 0.04;
/** なぞっている間、指の向いた辺のほかのロープの濃さ。 */
const UNFOCUSED_ROPE_OPACITY = 0.35;
/** マウスを乗せた所の予告の濃さ。 */
const HOVER_GHOST_OPACITY = 0.6;
/** 島を囲む輪は、島の陸の揺らいだ輪郭をこの大きさまで広げた形にする。 */
const SELECTION_RING_RADIUS = ISLAND_RADIUS + 0.1;
/** 離せば回す辺の相手の島を囲む輪。指で隠れても輪の外側が見える大きさにする。 */
const TARGET_RING_RADIUS = ISLAND_RADIUS + 0.16;
const TARGET_RING_WIDTH = 0.09;
const FOCUS_RING_RADIUS = ISLAND_RADIUS + 0.17;
const FOCUS_RING_WIDTH = 0.05;
/** 阻まれた辺に架かるはずだった板の濃さ。板そのものを透かし、下の海が見える濃さにする。 */
const BLOCKED_ATTEMPT_OPACITY = 0.5;
/** 灯った島の後ろの光の広さと、灯り切った後に残す濃さ。灯り切った姿を結果へ進むまで保つ。 */
const LANTERN_RADIUS = 0.78;
export const LANTERN_SETTLED_OPACITY = 0.7;
const LANTERN_POST_RADIUS = 0.075;
/** 灯った島から広がる波紋の、広がり始めの半径と線の太さ。広がると太さも同じ倍率で太る。 */
const RIPPLE_RADIUS = 0.5;
const RIPPLE_WIDTH = 0.07;

/** 数字の字の大きさ。島の陸の直径の6割ほどにする。 */
const CLUE_FONT_SIZE = 0.52;
/** 絵の中の海の波の印の、区画の寸法に掛ける倍率。マス幅の 1/40 を 1 とする。 */
const FIGURE_WAVE_UNIT = 1 / 40;

/** 辺の中心線から横へずらした線分。 */
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

/** 橋の本数ぶんの板が占める幅の半分。杭を板の外側に立てる位置に使う。 */
function getFootprintHalfWidth(
  count: BridgeCount,
  layout: PlankLayout,
): number {
  const offsets = getPlankOffsets(count, layout);
  return Math.max(...offsets.map(Math.abs)) + getPlankWidth(count, layout) / 2;
}

/**
 * 橋の両端の杭の位置。両端の島ごとに、板の外側の左右に1本ずつ立てる。
 * - `end`: 0 は線分の始めの島、1 は終わりの島。
 */
function listPostPoints(
  { start, end }: BoardSegment,
  count: BridgeCount,
  layout: PlankLayout,
): { point: BoardPoint; end: 0 | 1 }[] {
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
      point: {
        x: base.x + across.x * side * sign,
        y: base.y + across.y * side * sign,
      },
      end: endIndex,
    }));
  });
}

/**
 * 1枚の木の板。影、欄干の縁、板の面、横木の順に重ねる。`seams` が無ければ横木を刻まない。
 * `litDepth` を渡すと、灯った盤面で一瞬なる明るい木の色の面を、見えない姿で重ねておく（値はその板が灯る段数）。
 */
function BridgePlank({
  segment,
  width,
  seams,
  litDepth = null,
}: {
  segment: BoardSegment;
  width: number;
  seams: boolean;
  litDepth?: number | null;
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
      {litDepth !== null && (
        <g {...{ [bridgesFigureParts.litDeck]: litDepth }} opacity={0}>
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

/** 辺の橋の板。本数ぶんの板を、辺の中心線から横へずらして並べる。 */
function BridgePlanks({
  segment,
  count,
  layout,
  litDepth = null,
}: {
  segment: BoardSegment;
  count: BridgeCount;
  layout: PlankLayout;
  litDepth?: number | null;
}) {
  return getPlankOffsets(count, layout).map((offset, plank) => (
    <g key={offset} {...{ [bridgesFigureParts.bridgePlank]: plank }}>
      <BridgePlank
        segment={offsetSegment(segment, offset)}
        width={getPlankWidth(count, layout)}
        seams={layout.seams}
        litDepth={litDepth}
      />
    </g>
  ));
}

/** 橋の両端の浅瀬に立てる杭。 */
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
      {listPostPoints(segment, count, layout).map(({ point }) => (
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

/**
 * 辺の橋を回した後の姿の予告が占める幅。チュートリアルの印を、予告の板の影に沿わせるのに使う。
 * 1本・2本になるなら板の影の幅、なしになるなら今の板を覆う幅。
 */
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

/**
 * 離せば・押せば回る辺の、回した後の姿の予告。
 * 1本・2本になるなら、その本数の板の影を半透明で置く。なしになるなら、今の板に海の色を重ねて薄める。
 */
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

/**
 * 交わる橋に阻まれた辺で、押した端の島から阻んだ橋の手前まで伸びる1本の板。板そのものを半透明にし、橋と同じ木の姿で見せる。
 * `opacity` は盤面の反応で一瞬だけ点けるための濃さで、点いたときも板は半透明のままにする。
 * 伸ばす動きのために、板を伸ばし始める点（`data-origin-x`・`data-origin-y`）と向き（`data-axis`）を持つ。
 */
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

/** 島から架けられる相手までの区間に敷く帯。どの相手へ架けられるかを、ロープより広い面で示す。 */
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

/** マスの中心のうち、島の無い所に打つごく薄い点。島が縦横に並んでいることを、海の上の静かな手がかりで読めるようにする。 */
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

/** 遊び方の図とチュートリアルで、絵の地に敷く海。絵の枠いっぱいに敷き、角は絵を置く枠に合わせる。 */
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

/** 中心から外へ透けていく、円の塗りの色の移り。`stops` は [位置, 濃さ] の組。 */
function RadialFade({
  id,
  className,
  stops,
}: {
  id: string;
  className: string;
  stops: readonly (readonly [number, number])[];
}) {
  return (
    <radialGradient id={id}>
      {stops.map(([offset, opacity]) => (
        <stop
          key={offset}
          offset={offset}
          stopOpacity={opacity}
          className={className}
        />
      ))}
    </radialGradient>
  );
}

const centerOrigin = {
  transformBox: "fill-box",
  transformOrigin: "center",
} as const;

/**
 * 盤面の絵。下から、海・マスの中心の点・架けられる相手までの帯・浅瀬・灯った島の澄んだ浅瀬・波打ち際・灯りの光・波紋・板の予告・
 * 阻まれた辺の板・橋（阻んだ橋の縁取り、板、灯った板、杭）・外す板・杭の灯り・ロープ・交点の候補のロープ・島の陸と数字・
 * 選んだ島とキーボードの輪の順に重ねる。
 * 阻まれた辺の板の影は橋の下に置き、阻んだ橋がその上を渡って見えるようにする。
 * 橋は島の中心から中心へ描き、端を島の陸で覆う。
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
  selectedIsland = null,
  focusedIsland = null,
  blockingEdges = [],
  blockedAttempt = null,
  showsBlockingEdges = false,
  retractingEdge = null,
  lit = false,
  compact = false,
  ref,
}: BridgesFigureProps) {
  const layout = compact ? plankLayouts.compact : plankLayouts.regular;
  const gradientId = useId();
  const shallowsId = `${gradientId}-shallows`;
  const lanternId = `${gradientId}-lantern`;
  const litShallowsId = `${gradientId}-lit-shallows`;
  const { edges } = getBridgesNetwork(board);
  const islandCenters = board.islands.map((island) =>
    toViewPoint(view, getIslandCenter(island)),
  );
  const depths = lit ? listClearWaveDepths(board, bridges) : [];
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
    const outline = getIslandOutlinePath(
      board.islands[island]!,
      islandCenters[island]!,
      radius,
    );
    return (
      <>
        <path
          d={outline}
          fill="none"
          strokeWidth={width + ROPE_CASING_EXTRA}
          className={bridgesToneClassNames.guideCasing}
        />
        <path
          d={outline}
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
      // 海を描かない絵は画面全体の海の上に置くので、灯りと波紋を絵の外の海まで広げる。
      overflow={showsSea ? "hidden" : "visible"}
      aria-hidden="true"
    >
      <defs>
        <RadialFade
          id={shallowsId}
          className={bridgesToneClassNames.shallowsStop}
          stops={[
            [0, 1],
            [0.8, 1],
            [1, 0],
          ]}
        />
        <RadialFade
          id={litShallowsId}
          className={bridgesToneClassNames.litShallowsStop}
          stops={[
            [0, 1],
            [0.65, 1],
            [1, 0],
          ]}
        />
        <RadialFade
          id={lanternId}
          className={bridgesToneClassNames.lanternStop}
          stops={[
            [0, 1],
            [0.5, 0.75],
            [1, 0],
          ]}
        />
      </defs>
      {showsSea && <FigureSea view={view} />}
      <GridDots view={view} />
      {(guide || bandEdges.length > 0) && (
        <GuideBands
          view={view}
          edges={[...new Set([...(guide?.edges ?? []), ...bandEdges])]}
        />
      )}
      <g>
        {islandCenters.map(({ x, y }) => (
          <circle
            key={`${x}:${y}`}
            cx={x}
            cy={y}
            r={SHALLOWS_RADIUS}
            fill={`url(#${shallowsId})`}
          />
        ))}
      </g>
      {lit &&
        islandCenters.map(({ x, y }, island) => (
          <circle
            key={`lit-shallows-${x}:${y}`}
            {...{ [bridgesFigureParts.litShallows]: depths[island] ?? 0 }}
            cx={x}
            cy={y}
            r={LIT_SHALLOWS_RADIUS}
            fill={`url(#${litShallowsId})`}
            style={centerOrigin}
          />
        ))}
      <g
        fill="none"
        strokeWidth={SURF_WIDTH}
        className={bridgesToneClassNames.surf}
      >
        {board.islands.map((island, index) => (
          <path
            key={`${island.row}:${island.column}`}
            d={getIslandOutlinePath(
              island,
              islandCenters[index]!,
              ISLAND_RADIUS * SURF_SCALE,
            )}
          />
        ))}
      </g>
      {lit &&
        islandCenters.map(({ x, y }, island) => (
          <circle
            key={`lantern-${x}:${y}`}
            {...{ [bridgesFigureParts.lantern]: depths[island] ?? 0 }}
            cx={x}
            cy={y}
            r={LANTERN_RADIUS}
            fill={`url(#${lanternId})`}
            opacity={LANTERN_SETTLED_OPACITY}
            style={centerOrigin}
          />
        ))}
      {lit &&
        islandCenters.map(({ x, y }, island) => (
          <circle
            key={`ripple-${x}:${y}`}
            {...{ [bridgesFigureParts.ripple]: depths[island] ?? 0 }}
            cx={x}
            cy={y}
            r={RIPPLE_RADIUS}
            fill="none"
            strokeWidth={RIPPLE_WIDTH}
            className={bridgesToneClassNames.ripple}
            opacity={0}
            style={centerOrigin}
          />
        ))}
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
          >
            {blockingEdges.includes(edge) && (
              <g
                {...{ [bridgesFigureParts.blockingOutline]: edge }}
                opacity={showsBlockingEdges ? 1 : 0}
              >
                <SegmentLine
                  segment={segment}
                  className={bridgesToneClassNames.blockingBridge}
                  strokeWidth={
                    getFootprintHalfWidth(count, layout) * 2 +
                    BLOCKING_OUTLINE_EXTRA
                  }
                />
              </g>
            )}
            <BridgePlanks
              segment={segment}
              count={count}
              layout={layout}
              litDepth={
                lit ? Math.max(depths[from] ?? 0, depths[to] ?? 0) : null
              }
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
      {lit &&
        edges.flatMap(({ from, to }, edge) =>
          bridges[edge] === 0
            ? []
            : listPostPoints(
                getEdgeViewSegment(view, edge),
                bridges[edge]!,
                layout,
              ).map(({ point, end }) => (
                <circle
                  key={`lantern-post-${from}-${to}:${point.x}:${point.y}`}
                  {...{
                    [bridgesFigureParts.lanternPost]:
                      depths[end === 0 ? from : to] ?? 0,
                  }}
                  cx={point.x}
                  cy={point.y}
                  r={LANTERN_POST_RADIUS}
                  className={bridgesToneClassNames.lanternPost}
                />
              )),
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
          >
            <path
              d={getIslandOutlinePath(island, center, ISLAND_RADIUS)}
              strokeWidth={tone.rim ? OVER_RIM_WIDTH : WET_SAND_WIDTH}
              strokeDasharray={tone.rimDash}
              className={cn(
                tone.land,
                tone.rim ?? bridgesToneClassNames.wetSand,
              )}
            />
            {tone.grass && (
              <path
                d={getIslandOutlinePath(
                  island,
                  center,
                  ISLAND_RADIUS * GRASS_SCALE,
                )}
                className={tone.grass}
              />
            )}
            <text
              x={center.x}
              y={center.y}
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
