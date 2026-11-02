import {
  type BridgesBoard,
  type BridgesDirection,
  type BridgesIsland,
  findBridgesEdgeToward,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";

/**
 * 盤面の上の点。マス幅を 1 とし、左上のマスの左上の角を原点にする。マス (row, column) の中心は (column + 0.5, row + 0.5)。
 * 盤面の描画と押した位置の判定は、どちらもこの座標で行う。
 */
export type BoardPoint = { x: number; y: number };

/** 島の丸の半径。320px 幅の 10×10 でも直径 23px ほどを保ち、1桁の数字が読める大きさ。 */
export const ISLAND_RADIUS = 0.4;

/** 2本の橋の、平行な2線の中心どうしの間隔。 */
const DOUBLE_BRIDGE_SPACING = 0.2;

/** 島の外を押したとき、線からこの距離までを、その線の辺を押したとみなす。 */
const TAP_REACH = 0.5;

const pointTolerance = 1e-9;

/** 盤面全体を描いた枠の、画面上の位置と大きさ。 */
export type BoardFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** 画面上の点（`clientX`・`clientY`）を盤面の座標へ写す。 */
export function toBoardPoint(
  board: BridgesBoard,
  frame: BoardFrame,
  clientX: number,
  clientY: number,
): BoardPoint {
  return {
    x: ((clientX - frame.left) / frame.width) * board.width,
    y: ((clientY - frame.top) / frame.height) * board.height,
  };
}

export function getIslandCenter(island: BridgesIsland): BoardPoint {
  return { x: island.column + 0.5, y: island.row + 0.5 };
}

/** 辺の線分。両端は島の丸の縁で、丸の中には線を描かない。 */
export type BoardSegment = { start: BoardPoint; end: BoardPoint };

export function getEdgeSegment(
  board: BridgesBoard,
  edge: number,
): BoardSegment {
  const { from, to, orientation } = getBridgesNetwork(board).edges[edge]!;
  const start = getIslandCenter(board.islands[from]!);
  const end = getIslandCenter(board.islands[to]!);
  return orientation === "horizontal"
    ? {
        start: { x: start.x + ISLAND_RADIUS, y: start.y },
        end: { x: end.x - ISLAND_RADIUS, y: end.y },
      }
    : {
        start: { x: start.x, y: start.y + ISLAND_RADIUS },
        end: { x: end.x, y: end.y - ISLAND_RADIUS },
      };
}

/** 橋の本数ぶんの線を、辺の中心線から横へずらす量。1本は中心線の上、2本は中心線を挟んだ平行な2線。 */
export function getBridgeLineOffsets(count: BridgeCount): readonly number[] {
  if (count === 0) return [];
  return count === 1
    ? [0]
    : [-DOUBLE_BRIDGE_SPACING / 2, DOUBLE_BRIDGE_SPACING / 2];
}

/**
 * 押した位置が指すもの。島の丸の中なら島、島の外で線に近ければ辺。
 * 交わる2辺の交点の真上のように、どちらを狙ったか決まらないときは `ambiguous` で候補の辺を返す。
 */
export type BoardTarget =
  | { kind: "island"; island: number }
  | { kind: "edge"; edge: number }
  | { kind: "ambiguous"; edges: readonly number[] };

function findIslandAt(board: BridgesBoard, point: BoardPoint): number | null {
  const index = board.islands.findIndex((island) => {
    const center = getIslandCenter(island);
    return (
      Math.hypot(point.x - center.x, point.y - center.y) <=
      ISLAND_RADIUS + pointTolerance
    );
  });
  return index < 0 ? null : index;
}

/**
 * 島の外を押した点から見た、1つの候補の辺。
 * - `distance`: 線（2島の中心を結ぶ線）までの距離。
 * - `midpointOffset`: 2島の間の真ん中からの、線に沿ったずれを、真ん中から島の中心までの長さで割った値（真ん中で 0、島の中心で 1）。
 * - `midpointDistance`: 2島の間の真ん中までの距離。
 * - `span`: 2島の中心の間の長さ。
 */
type EdgeCandidate = {
  edge: number;
  distance: number;
  midpointOffset: number;
  midpointDistance: number;
  span: number;
};

/**
 * 交わる2辺の交点の近くで、線までの距離の差がこれ以下なら、人はどちらの線を狙ったか距離では分からないとみなし、
 * 2島の間の真ん中に近い方を選ぶ。人は「つなぎたい2島の間の真ん中」を押すので、短い辺の真ん中が長い辺の上に乗る所で、
 * 最も近い線だけでは狙いと違う辺を選ぶ。値は、問題集の盤面で真ん中を狙う押し方と、交点を避けて線を狙う押し方を
 * 指のぶれ付きで模した比較で、前者の当たりが上がり、後者の当たりがほとんど落ちない所に置いた。
 */
const CROSSING_AMBIGUITY = 0.15;

/**
 * 交わる2辺の真ん中がどちらもこの距離の内にあれば、真ん中が重なっているとみなし、短い辺を選ぶ。
 * 真ん中が重なる所では、真ん中からのずれは指のぶれでしか決まらないので、いつも同じ辺を選んで予測できるようにする。
 * 長い辺は、交点を避けた所を押すかなぞって架ける。
 */
const SHARED_MIDPOINT_RADIUS = 0.15;

/** 両端の島の中心の間にあり、線から半マスまでの辺。 */
function listReachableEdges(
  board: BridgesBoard,
  point: BoardPoint,
): EdgeCandidate[] {
  return getBridgesNetwork(board).edges.flatMap(
    ({ from, to, orientation }, edge) => {
      const start = getIslandCenter(board.islands[from]!);
      const end = getIslandCenter(board.islands[to]!);
      const [along, across, low, high, line] =
        orientation === "horizontal"
          ? [point.x, point.y, start.x, end.x, start.y]
          : [point.y, point.x, start.y, end.y, start.x];
      const distance = Math.abs(across - line);
      const halfSpan = (high - low) / 2;
      const alongOffset = Math.abs(along - (low + halfSpan));
      return low < along && along < high && distance <= TAP_REACH
        ? [
            {
              edge,
              distance,
              midpointOffset: alongOffset / halfSpan,
              midpointDistance: Math.hypot(alongOffset, distance),
              span: high - low,
            },
          ]
        : [];
    },
  );
}

function compareBySpan(left: EdgeCandidate, right: EdgeCandidate): number {
  return left.span - right.span;
}

function compareByMidpoint(left: EdgeCandidate, right: EdgeCandidate): number {
  const offsetDifference = left.midpointOffset - right.midpointOffset;
  return Math.abs(offsetDifference) > pointTolerance
    ? offsetDifference
    : compareBySpan(left, right);
}

/** 並べた先頭の辺。先頭と2番目が `compare` で同じなら、押し分けられないので `null`。 */
function findFirst(
  candidates: readonly EdgeCandidate[],
  compare: (left: EdgeCandidate, right: EdgeCandidate) => number,
): number | null {
  const [first, second] = [...candidates].sort(compare);
  return second && compare(first!, second) === 0 ? null : first!.edge;
}

/**
 * 押した点が指す辺。線が最も近い辺を選ぶ。最も近い辺と交わり、線までの距離の差が `CROSSING_AMBIGUITY` 以下の辺があれば、
 * 真ん中が重なっていれば短い辺を、そうでなければ2島の間の真ん中に近い（線に沿ったずれが辺の長さに対して小さい）辺を選ぶ。
 * - `ambiguous`: 選び分けた辺の候補（最も近い辺と、それと見分けにくい交わる辺）。
 * - `edge`: 選んだ辺。それでも決まらない（交点の真上、同じ距離の平行な2線など）ときは `null`。
 */
function selectEdge(
  candidates: readonly EdgeCandidate[],
  crossingEdges: readonly (readonly number[])[],
): { ambiguous: readonly EdgeCandidate[]; edge: number | null } {
  const nearestDistance = Math.min(
    ...candidates.map(({ distance }) => distance),
  );
  const closest = candidates.filter(
    ({ distance }) => distance - nearestDistance <= pointTolerance,
  );
  const ambiguous = candidates.filter(
    (candidate) =>
      closest.includes(candidate) ||
      (candidate.distance - nearestDistance <= CROSSING_AMBIGUITY &&
        closest.some(({ edge }) =>
          crossingEdges[edge]!.includes(candidate.edge),
        )),
  );
  if (ambiguous.length === 1) {
    return { ambiguous, edge: ambiguous[0]!.edge };
  }
  const crosses = ambiguous.some(({ edge }) =>
    ambiguous.some((other) => crossingEdges[edge]!.includes(other.edge)),
  );
  if (!crosses) {
    return { ambiguous, edge: null };
  }
  const atSharedMidpoint = ambiguous.filter(
    ({ midpointDistance }) => midpointDistance <= SHARED_MIDPOINT_RADIUS,
  );
  return {
    ambiguous,
    edge:
      atSharedMidpoint.length >= 2
        ? findFirst(atSharedMidpoint, compareBySpan)
        : findFirst(ambiguous, compareByMidpoint),
  };
}

/**
 * 押した位置が指す島か辺。島の丸の中なら島。島の外なら、線から半マスまでの辺から `selectEdge` で選ぶ。
 * 選んだ辺が交わる橋に阻まれていても、そのまま返す（架けようとして阻まれたことを盤面で返す）。
 * ただし、阻んでいる橋の辺が選んだ辺と見分けにくい候補に入っているときは、その橋のある辺を選ぶ。
 * 交わる2辺の近くでどちらを狙ったか分からないときは、片方にだけ橋があればそれを回す方が狙いに近い。
 * 決まらないときは、候補の辺を `ambiguous` で返す。
 */
export function findBoardTarget(
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
  point: BoardPoint,
): BoardTarget | null {
  const island = findIslandAt(board, point);
  if (island !== null) {
    return { kind: "island", island };
  }
  const candidates = listReachableEdges(board, point);
  if (candidates.length === 0) {
    return null;
  }
  const { crossingEdges } = getBridgesNetwork(board);
  const { ambiguous, edge } = selectEdge(candidates, crossingEdges);
  const bridgedAlternatives = ambiguous.filter(
    (candidate) =>
      bridges[candidate.edge] !== 0 &&
      (edge === null || crossingEdges[edge]!.includes(candidate.edge)),
  );
  if (
    (edge === null || bridges[edge] === 0) &&
    bridgedAlternatives.length === 1
  ) {
    return { kind: "edge", edge: bridgedAlternatives[0]!.edge };
  }
  if (edge === null) {
    return {
      kind: "ambiguous",
      edges: ambiguous.map((candidate) => candidate.edge),
    };
  }
  return { kind: "edge", edge };
}

/**
 * なぞりで縦横のどちらへ向かったかを決めるのに要る、離れた量の比。縦と横の離れた量の大きい方が、小さい方のこの倍以上なら、
 * 大きい方の向きにする。縦と横に同じくらい動いた斜めに近いなぞりは、どちらの島を狙ったか分からないので向きを決めない。
 */
const DRAG_DOMINANCE_RATIO = 1.5;

const horizontalDirections = { positive: "right", negative: "left" } as const;
const verticalDirections = { positive: "down", negative: "up" } as const;

/**
 * 島 `island` からなぞって `point` で離したときに橋を回す辺。決まらなければ `null`。
 * - 隣の島（`island` から辺の伸びる島）の丸の中で離したら、その辺。
 * - 島の丸の中で離したら、なぞっていないので `null`。
 * - それ以外は、島の中心から見て縦横の離れた量の大きい方の向きの辺。斜めに近いとき（`DRAG_DOMINANCE_RATIO`）は、
 *   近い2つの向きのうち辺のある向きが1つだけならその辺、どちらにもあれば狙いが分からないので `null`。
 */
export function findDragEdge(
  board: BridgesBoard,
  island: number,
  point: BoardPoint,
): number | null {
  const { edges, islandEdges } = getBridgesNetwork(board);
  const releasedOn = findIslandAt(board, point);
  if (releasedOn === island) {
    return null;
  }
  if (releasedOn !== null) {
    return (
      islandEdges[island]!.find((edge) => {
        const { from, to } = edges[edge]!;
        return from === releasedOn || to === releasedOn;
      }) ?? null
    );
  }
  const center = getIslandCenter(board.islands[island]!);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (Math.hypot(dx, dy) <= ISLAND_RADIUS) {
    return null;
  }
  const horizontal = findBridgesEdgeToward(
    board,
    island,
    horizontalDirections[dx >= 0 ? "positive" : "negative"],
  );
  const vertical = findBridgesEdgeToward(
    board,
    island,
    verticalDirections[dy >= 0 ? "positive" : "negative"],
  );
  const [major, minor] = [Math.abs(dx), Math.abs(dy)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  if (major >= minor * DRAG_DOMINANCE_RATIO) {
    return Math.abs(dx) >= Math.abs(dy) ? horizontal : vertical;
  }
  if (horizontal !== null && vertical !== null) {
    return null;
  }
  return horizontal ?? vertical;
}

const directionVectors = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const satisfies Record<BridgesDirection, BoardPoint>;

/**
 * キーボードで `direction` の向きへ移るときの、次の島。その向きに辺のある島があればその島、無ければ、その向きにある島のうち
 * 向きに沿った距離と横へのずれの2倍の和が最も小さい島。その向きに島が無ければ `null`。
 */
export function findIslandToward(
  board: BridgesBoard,
  island: number,
  direction: BridgesDirection,
): number | null {
  const edge = findBridgesEdgeToward(board, island, direction);
  if (edge !== null) {
    const { from, to } = getBridgesNetwork(board).edges[edge]!;
    return from === island ? to : from;
  }
  const origin = board.islands[island]!;
  const vector = directionVectors[direction];
  let best: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const [index, other] of board.islands.entries()) {
    const dx = other.column - origin.column;
    const dy = other.row - origin.row;
    const along = dx * vector.x + dy * vector.y;
    if (along <= 0) {
      continue;
    }
    const score = along + 2 * Math.abs(dx * vector.y + dy * vector.x);
    if (score < bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return best;
}
