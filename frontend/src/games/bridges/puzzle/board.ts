/**
 * 島。`clue` は島の数字で、その島から出る橋の本数。
 */
export type BridgesIsland = {
  row: number;
  column: number;
  clue: number;
};

/**
 * 幅 `width`・高さ `height` のマス目に島を置いた盤面。
 * 島は行優先（上の行から、同じ行は左から）に並べ、島の番号はこの並びの位置。
 * 島どうしは上下左右に隣り合わない。隣り合う2島の間には線を引くすき間が無く、押し分けられないため。
 */
export type BridgesBoard = {
  width: number;
  height: number;
  islands: readonly BridgesIsland[];
};

/** 同じ2島の間に架けられる橋の本数の上限。 */
export const BRIDGES_MAXIMUM_BRIDGE_COUNT = 2;

/** 島の数字の上限。上下左右の4方向に2本ずつ。 */
export const BRIDGES_MAXIMUM_CLUE = 4 * BRIDGES_MAXIMUM_BRIDGE_COUNT;

export const bridgesDirections = ["up", "right", "down", "left"] as const;

export type BridgesDirection = (typeof bridgesDirections)[number];

export type BridgesOrientation = "horizontal" | "vertical";

/**
 * 同じ行か列にあり、間に島の無い2島の組。橋を架けられる候補で、橋の本数は辺の番号ごとに持つ。
 * `from` は左（縦なら上）の島、`to` は右（縦なら下）の島の番号。
 */
export type BridgesEdge = {
  from: number;
  to: number;
  orientation: BridgesOrientation;
};

/**
 * 盤面から決まる、辺とその関係。
 * - `edges`: 辺。島の番号の順に、各島から右・下へ伸びる辺を並べる。
 * - `islandEdges`: 島ごとの、その島を端に持つ辺の番号。
 * - `crossingEdges`: 辺ごとの、途中で交わる辺の番号。交わる2辺には同時に橋を架けられない。
 */
export type BridgesNetwork = {
  edges: readonly BridgesEdge[];
  islandEdges: readonly (readonly number[])[];
  crossingEdges: readonly (readonly number[])[];
};

const directionOffsets = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
} as const satisfies Record<BridgesDirection, { row: number; column: number }>;

function createIslandIndex(board: BridgesBoard): Map<number, number> {
  return new Map(
    board.islands.map((island, index) => [
      island.row * board.width + island.column,
      index,
    ]),
  );
}

/** `island` から `direction` の向きにまっすぐ進んで最初に出会う島の番号。盤面の端まで島が無ければ `null`。 */
function findFacingIsland(
  board: BridgesBoard,
  islandIndex: ReadonlyMap<number, number>,
  island: BridgesIsland,
  direction: BridgesDirection,
): number | null {
  const offset = directionOffsets[direction];
  for (
    let row = island.row + offset.row, column = island.column + offset.column;
    row >= 0 && row < board.height && column >= 0 && column < board.width;
    row += offset.row, column += offset.column
  ) {
    const facing = islandIndex.get(row * board.width + column);
    if (facing !== undefined) {
      return facing;
    }
  }
  return null;
}

function listEdges(board: BridgesBoard): BridgesEdge[] {
  const islandIndex = createIslandIndex(board);
  return board.islands.flatMap(function edgesFrom(island, from) {
    const right = findFacingIsland(board, islandIndex, island, "right");
    const down = findFacingIsland(board, islandIndex, island, "down");
    return [
      ...(right === null
        ? []
        : [{ from, to: right, orientation: "horizontal" as const }]),
      ...(down === null
        ? []
        : [{ from, to: down, orientation: "vertical" as const }]),
    ];
  });
}

/** 横の辺と縦の辺が、どちらの端でもない所で交わるか。 */
function doEdgesCross(
  board: BridgesBoard,
  left: BridgesEdge,
  right: BridgesEdge,
): boolean {
  if (left.orientation === right.orientation) {
    return false;
  }
  const [horizontal, vertical] =
    left.orientation === "horizontal" ? [left, right] : [right, left];
  const row = board.islands[horizontal.from]!.row;
  const column = board.islands[vertical.from]!.column;
  return (
    board.islands[horizontal.from]!.column < column &&
    column < board.islands[horizontal.to]!.column &&
    board.islands[vertical.from]!.row < row &&
    row < board.islands[vertical.to]!.row
  );
}

function createNetwork(board: BridgesBoard): BridgesNetwork {
  const edges = listEdges(board);
  const islandEdges = board.islands.map(() => [] as number[]);
  for (const [edge, { from, to }] of edges.entries()) {
    islandEdges[from]!.push(edge);
    islandEdges[to]!.push(edge);
  }
  const crossingEdges = edges.map((edge) =>
    edges.flatMap((other, index) =>
      doEdgesCross(board, edge, other) ? [index] : [],
    ),
  );
  return { edges, islandEdges, crossingEdges };
}

const networks = new WeakMap<BridgesBoard, BridgesNetwork>();

/** 盤面の辺とその関係。同じ盤面の値には同じ結果を返す。 */
export function getBridgesNetwork(board: BridgesBoard): BridgesNetwork {
  const cached = networks.get(board);
  if (cached) {
    return cached;
  }
  const network = createNetwork(board);
  networks.set(board, network);
  return network;
}

/** `island` の島から `direction` の向きへ伸びる辺の番号。その向きに島が無ければ `null`。 */
export function findBridgesEdgeToward(
  board: BridgesBoard,
  island: number,
  direction: BridgesDirection,
): number | null {
  const { edges, islandEdges } = getBridgesNetwork(board);
  const origin = board.islands[island];
  if (origin === undefined) {
    return null;
  }
  const offset = directionOffsets[direction];
  return (
    islandEdges[island]!.find((edgeIndex) => {
      const edge = edges[edgeIndex]!;
      const other = board.islands[edge.from === island ? edge.to : edge.from]!;
      return (
        Math.sign(other.row - origin.row) === offset.row &&
        Math.sign(other.column - origin.column) === offset.column
      );
    }) ?? null
  );
}

function isInsideBoard(board: BridgesBoard, island: BridgesIsland): boolean {
  return (
    Number.isInteger(island.row) &&
    Number.isInteger(island.column) &&
    island.row >= 0 &&
    island.row < board.height &&
    island.column >= 0 &&
    island.column < board.width
  );
}

function comparePositions(left: BridgesIsland, right: BridgesIsland): number {
  return left.row - right.row || left.column - right.column;
}

function areOrthogonallyAdjacent(
  left: BridgesIsland,
  right: BridgesIsland,
): boolean {
  return (
    Math.abs(left.row - right.row) + Math.abs(left.column - right.column) === 1
  );
}

export function assertBridgesBoard(board: BridgesBoard): void {
  const { width, height, islands } = board;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new RangeError("Bridges board size must be positive integers");
  }
  if (islands.length === 0) {
    throw new RangeError("Bridges board must have an island");
  }
  if (!islands.every((island) => isInsideBoard(board, island))) {
    throw new RangeError("Bridges islands must be on the board");
  }
  if (
    !islands.every(
      (island, index) =>
        index === 0 || comparePositions(islands[index - 1]!, island) < 0,
    )
  ) {
    throw new RangeError("Bridges islands must be distinct in row-major order");
  }
  if (
    !islands.every(
      ({ clue }) =>
        Number.isInteger(clue) && clue >= 1 && clue <= BRIDGES_MAXIMUM_CLUE,
    )
  ) {
    throw new RangeError(
      `Bridges island clues must be integers from 1 to ${BRIDGES_MAXIMUM_CLUE}`,
    );
  }
  if (
    islands.some((island, index) =>
      islands
        .slice(index + 1)
        .some((other) => areOrthogonallyAdjacent(island, other)),
    )
  ) {
    throw new RangeError("Bridges islands must not be orthogonally adjacent");
  }
}

const emptyCellNotation = ".";

/**
 * 盤面を記法の行で表す。固定問題・テストで盤面を読みやすく書くための記法。
 * 1行がマス目の1行で、1マスを1文字で書く（`.` 島の無いマス、`1`〜`8` その数字の島）。
 * 例: 3×3 で左上と右上が2の島 → `["2.2", "...", "..."]`。
 */
export function formatBridgesBoard(board: BridgesBoard): string[] {
  const rows = Array.from({ length: board.height }, () =>
    Array.from({ length: board.width }, () => emptyCellNotation),
  );
  for (const { row, column, clue } of board.islands) {
    rows[row]![column] = String(clue);
  }
  return rows.map((cells) => cells.join(""));
}

/** `formatBridgesBoard` の記法から盤面を作る。 */
export function parseBridgesBoard(rows: readonly string[]): BridgesBoard {
  const width = rows[0]?.length ?? 0;
  const islands: BridgesIsland[] = [];
  for (const [row, line] of rows.entries()) {
    if (line.length !== width) {
      throw new RangeError(
        `Bridges notation row must have ${width} cells: ${line}`,
      );
    }
    for (const [column, notation] of [...line].entries()) {
      if (notation === emptyCellNotation) {
        continue;
      }
      if (!/^[1-9]$/.test(notation)) {
        throw new RangeError(`Unknown Bridges cell notation: ${notation}`);
      }
      islands.push({ row, column, clue: Number(notation) });
    }
  }
  const board = { width, height: rows.length, islands };
  assertBridgesBoard(board);
  return board;
}
