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
 * 島から架けられる相手へ張るロープ。島を押している間と、島を選んでいる間に見せる。
 * - `island`: ロープを張る元の島。
 * - `edges`: 島から伸びる辺。
 * - `previewEdge`: 今離せば橋を回す辺。決まらなければ `null`。
 * - `focusesPreview`: `previewEdge` のほかのロープを淡くし、離せば回す辺だけを目立たせるか。なぞっている間に使う。
 */
export type BridgesFigureGuide = {
  island: number;
  edges: readonly number[];
  previewEdge: number | null;
  focusesPreview: boolean;
};

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
  /** 全島がつながった盤面を灯すか。島の灯り、杭の灯り、光る浅瀬、明るい海を描く。 */
  lit?: boolean;
  ref?: Ref<SVGSVGElement>;
};

/** 演出が図の部品を探すための属性。灯りの部品の値は、その島が灯る段数。 */
export const bridgesFigureParts = {
  island: "data-bridges-island",
  bridgeEdge: "data-bridges-edge",
  bridgePlank: "data-bridges-plank",
  plankShadow: "data-bridges-plank-shadow",
  retracting: "data-bridges-retracting",
  blockingBridges: "data-bridges-blocking",
  lantern: "data-bridges-lantern",
  lanternPost: "data-bridges-lantern-post",
  lagoon: "data-bridges-lagoon",
  ripple: "data-bridges-ripple",
  seaLit: "data-bridges-sea-lit",
} as const;

/** 図の寸法はマス幅を 1 とした値。 */
const SINGLE_PLANK_WIDTH = 0.26;
const DOUBLE_PLANK_WIDTH = 0.18;
const PLANK_RAIL_WIDTH = 0.035;
/** 板の横木の太さと間隔。板の幅ほどの間を空けて間引き、梯子や線路の枕木に見せない。 */
const PLANK_SEAM_DASH = "0.025 0.155";
/** 板の影を落とす向き。光を左上から当て、右下へ落とす。 */
const SHADOW_OFFSET = { x: 0.02, y: 0.045 } as const;
/** 杭の半径と、島の中心から杭までの距離。杭は陸の縁の外の浅瀬に立てる。 */
const POST_RADIUS = 0.042;
const POST_DISTANCE = ISLAND_RADIUS + 0.09;
/** 浅瀬が海の色へ消えるまでの、島の中心からの距離。 */
const SHALLOWS_RADIUS = 1;
/** 波打ち際の泡の、陸の輪郭に対する倍率と、泡の切れ目。 */
const SURF_SCALE = 1.14;
const SURF_WIDTH = 0.032;
const SURF_DASH = "0.08 0.055";
/** 陸の縁の濡れた砂の太さ。 */
const WET_SAND_WIDTH = 0.05;
/** 多すぎの島の、途切れた縁の太さ。 */
const OVER_RIM_WIDTH = 0.085;
/** ちょうどの島の草地の、陸の輪郭に対する倍率。砂の縁を残して中に広げる。 */
const GRASS_SCALE = 0.74;
/** 阻んだ橋を点ける線の太さ。2本の橋の2枚の板を覆う太さにし、橋の上に重ねても見分けられるようにする。 */
const BLOCKING_LINE_WIDTH = 0.54;
/** ロープの太さと撚りの切れ目、縁の太さ。 */
const ROPE_WIDTH = 0.12;
const ROPE_DASH = "0.15 0.07";
const PREVIEW_ROPE_WIDTH = 0.12;
/** 板の影を、板より少し太く描く分。ロープを上に重ねても、ロープの両脇に影が見える。 */
const GHOST_EXTRA_WIDTH = 0.08;
const ROPE_CASING_EXTRA = 0.07;
/** なぞっている間、離せば回す辺のほかのロープの濃さ。 */
const UNFOCUSED_ROPE_OPACITY = 0.35;
/** マウスを乗せた所の予告の濃さ。 */
const HOVER_GHOST_OPACITY = 0.6;
const SELECTION_RING_RADIUS = ISLAND_RADIUS + 0.1;
/** 離せば回す辺の相手の島を囲む輪。指で隠れても輪の外側が見える大きさにする。 */
const TARGET_RING_RADIUS = ISLAND_RADIUS + 0.16;
const TARGET_RING_WIDTH = 0.09;
const FOCUS_RING_RADIUS = ISLAND_RADIUS + 0.17;
const FOCUS_RING_WIDTH = 0.05;
/** 灯った島の後ろの光と、光る浅瀬の広さ。 */
const LANTERN_RADIUS = 0.82;
const LAGOON_RADIUS = 1.3;
const LANTERN_POST_RADIUS = 0.06;
/** 灯った島から広がる波紋の、広がり始めの半径と線の太さ。広がると太さも同じ倍率で太る。 */
const RIPPLE_RADIUS = 0.5;
const RIPPLE_WIDTH = 0.16;
/** 1つの島から広がる波紋の番号。3重に広げる。 */
const RIPPLE_RINGS = [0, 1, 2] as const;
/** 数字の字の大きさ。島の陸の直径の6割ほどにする。 */
const CLUE_FONT_SIZE = 0.52;
/** 遊び方の図とチュートリアルで描く海の角の丸み。 */
const SEA_CORNER_RADIUS = 0.3;
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

function getPlankWidth(count: BridgeCount): number {
  return count === 2 ? DOUBLE_PLANK_WIDTH : SINGLE_PLANK_WIDTH;
}

/** 橋の本数ぶんの板が占める幅の半分。杭を板の外側に立てる位置に使う。 */
function getFootprintHalfWidth(count: BridgeCount): number {
  const offsets = getBridgeLineOffsets(count);
  return Math.max(...offsets.map(Math.abs)) + getPlankWidth(count) / 2;
}

/**
 * 橋の両端の杭の位置。両端の島ごとに、板の外側の左右に1本ずつ立てる。
 * - `end`: 0 は線分の始めの島、1 は終わりの島。
 */
function listPostPoints(
  { start, end }: BoardSegment,
  count: BridgeCount,
): { point: BoardPoint; end: 0 | 1 }[] {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const along = {
    x: (end.x - start.x) / length,
    y: (end.y - start.y) / length,
  };
  const across = { x: -along.y, y: along.x };
  const side = getFootprintHalfWidth(count) + POST_RADIUS * 0.4;
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

/** 1枚の木の板。影、欄干の縁、板の面、横木の順に重ねる。 */
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
  return getBridgeLineOffsets(count).map((offset, plank) => (
    <g key={offset} {...{ [bridgesFigureParts.bridgePlank]: plank }}>
      <BridgePlank
        segment={offsetSegment(segment, offset)}
        width={getPlankWidth(count)}
      />
    </g>
  ));
}

/** 橋の両端の浅瀬に立てる杭。 */
function BridgePosts({
  segment,
  count,
}: {
  segment: BoardSegment;
  count: BridgeCount;
}) {
  return (
    <g className={bridgesToneClassNames.bridgePost}>
      {listPostPoints(segment, count).map(({ point }) => (
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
 * 離せば・押せば回る辺の、回した後の姿の予告。
 * 1本・2本になるなら、その本数の板の影を半透明で置く。なしになるなら、今の板に海の色を重ねて薄める。
 */
function GhostBridge({
  segment,
  current,
  opacity = 1,
}: {
  segment: BoardSegment;
  current: BridgeCount;
  opacity?: number;
}) {
  const next = ((current + 1) % 3) as BridgeCount;
  if (next === 0) {
    return (
      <SegmentLine
        segment={segment}
        className={bridgesToneClassNames.guideRemoval}
        strokeWidth={getFootprintHalfWidth(current) * 2 + 0.04}
        opacity={opacity}
      />
    );
  }
  return (
    <g opacity={opacity}>
      {getBridgeLineOffsets(next).map((offset) => (
        <SegmentLine
          key={offset}
          segment={offsetSegment(segment, offset)}
          className={bridgesToneClassNames.guideGhost}
          strokeWidth={getPlankWidth(next) + GHOST_EXTRA_WIDTH}
        />
      ))}
    </g>
  );
}

function Rope({
  segment,
  strokeWidth,
  dashed,
  opacity,
}: {
  segment: BoardSegment;
  strokeWidth: number;
  dashed: boolean;
  opacity: number;
}) {
  return (
    <g opacity={opacity}>
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

/** 遊び方の図とチュートリアルで、絵の地に敷く海。灯った盤面では、明るい海を重ねる。 */
function FigureSea({ view, lit }: { view: BoardView; lit: boolean }) {
  return (
    <>
      <rect
        width={view.width}
        height={view.height}
        rx={SEA_CORNER_RADIUS}
        className={bridgesToneClassNames.seaFill}
      />
      {lit && (
        <rect
          {...{ [bridgesFigureParts.seaLit]: "" }}
          width={view.width}
          height={view.height}
          rx={SEA_CORNER_RADIUS}
          className={bridgesToneClassNames.seaLitFill}
        />
      )}
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
 * 盤面の絵。下から、海・浅瀬・波打ち際・光る浅瀬・灯りの光・波紋・板の予告・橋の板と杭・外す板・阻んだ橋の点灯・
 * 杭の灯り・ロープ・島の陸と数字・選んだ島とキーボードの輪の順に重ねる。橋は島の中心から中心へ描き、端を島の陸で覆う。
 */
export function BridgesFigure({
  board,
  view = createBoardView(board),
  bridges,
  islandStatuses,
  showsSea = false,
  guide = null,
  hoverEdge = null,
  selectedIsland = null,
  focusedIsland = null,
  blockingEdges = [],
  showsBlockingEdges = false,
  retractingEdge = null,
  lit = false,
  ref,
}: BridgesFigureProps) {
  const gradientId = useId();
  const shallowsId = `${gradientId}-shallows`;
  const lanternId = `${gradientId}-lantern`;
  const lagoonId = `${gradientId}-lagoon`;
  const { edges } = getBridgesNetwork(board);
  const islandCenters = board.islands.map((island) =>
    toViewPoint(getIslandCenter(island)),
  );
  const depths = lit ? listClearWaveDepths(board, bridges) : [];
  const previewEdge = guide?.previewEdge ?? null;
  const ghostEdge = previewEdge ?? hoverEdge;
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
            [0.46, 1],
            [0.62, 0.55],
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
        <RadialFade
          id={lagoonId}
          className={bridgesToneClassNames.lagoonStop}
          stops={[
            [0, 1],
            [0.45, 0.85],
            [1, 0],
          ]}
        />
      </defs>
      {showsSea && <FigureSea view={view} lit={lit} />}
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
      <g
        fill="none"
        strokeWidth={SURF_WIDTH}
        strokeDasharray={SURF_DASH}
        strokeLinecap="round"
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
            key={`lagoon-${x}:${y}`}
            {...{ [bridgesFigureParts.lagoon]: depths[island] ?? 0 }}
            cx={x}
            cy={y}
            r={LAGOON_RADIUS}
            fill={`url(#${lagoonId})`}
            style={centerOrigin}
          />
        ))}
      {lit &&
        islandCenters.map(({ x, y }, island) => (
          <circle
            key={`lantern-${x}:${y}`}
            {...{ [bridgesFigureParts.lantern]: depths[island] ?? 0 }}
            cx={x}
            cy={y}
            r={LANTERN_RADIUS}
            fill={`url(#${lanternId})`}
            style={centerOrigin}
          />
        ))}
      {lit &&
        islandCenters.flatMap(({ x, y }, island) =>
          RIPPLE_RINGS.map((ring) => (
            <circle
              key={`ripple-${x}:${y}:${ring}`}
              {...{ [bridgesFigureParts.ripple]: depths[island] ?? 0 }}
              data-ring={ring}
              cx={x}
              cy={y}
              r={RIPPLE_RADIUS}
              fill="none"
              strokeWidth={RIPPLE_WIDTH}
              className={bridgesToneClassNames.ripple}
              opacity={0}
              style={centerOrigin}
            />
          )),
        )}
      {ghostEdge !== null && bridges[ghostEdge] !== 2 && (
        <GhostBridge
          segment={getEdgeViewSegment(view, ghostEdge)}
          current={bridges[ghostEdge]!}
          opacity={previewEdge === null ? HOVER_GHOST_OPACITY : 1}
        />
      )}
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
            <BridgePosts
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
      {ghostEdge !== null && bridges[ghostEdge] === 2 && (
        <GhostBridge
          segment={getEdgeViewSegment(view, ghostEdge)}
          current={2}
          opacity={previewEdge === null ? HOVER_GHOST_OPACITY : 1}
        />
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
        edges.flatMap(({ from, to }, edge) =>
          bridges[edge] === 0
            ? []
            : listPostPoints(
                getEdgeViewSegment(view, edge),
                bridges[edge]!,
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
                segment={getEdgeViewSegment(view, edge)}
                strokeWidth={previewing ? PREVIEW_ROPE_WIDTH : ROPE_WIDTH}
                dashed={!previewing}
                opacity={
                  guide.focusesPreview &&
                  guide.previewEdge !== null &&
                  !previewing
                    ? UNFOCUSED_ROPE_OPACITY
                    : 1
                }
              />
            );
          })}
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
        bridgesToneClassNames.focusRing,
      )}
    </svg>
  );
}
