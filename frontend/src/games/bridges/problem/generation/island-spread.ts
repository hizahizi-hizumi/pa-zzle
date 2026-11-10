import {
  type BridgesBoard,
  type BridgesIsland,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { type ProblemRandom, pickProblemValue } from "@/games/problem-seed";

/**
 * 島を広げる条件。生成条件（`BridgesGenerationConditions`）のうち広げ方に使う値で、問題集の値に限らない。
 * `islandDensity` は島の数の下限の、盤面のマスに対する割合。
 */
export type BridgesSpreadConditions = {
  size: number;
  islandDensity: number;
  doubleBridgeRate: number;
  extraBridgeRate: number;
  splitRate: number;
};

/** 完成した橋の配置から数字を出した盤面と、その配置（辺ごとの本数）。 */
export type BridgesCompletedLayout = {
  board: BridgesBoard;
  solution: readonly number[];
};

type CellPosition = { row: number; column: number };

/** 新しい島を、つなぐ島へ向かう道（間のマス）と一緒に表す。 */
type Placement = {
  cell: CellPosition;
  anchor: number;
  path: readonly CellPosition[];
};

const directionSteps = [
  { row: -1, column: 0 },
  { row: 1, column: 0 },
  { row: 0, column: -1 },
  { row: 0, column: 1 },
] as const;

/** 重み `weightOf` に比べた確率で1つを選ぶ。空でない `values` と、正の重みを受け取る。 */
function pickWeighted<T>(
  values: readonly T[],
  random: ProblemRandom,
  weightOf: (value: T) => number,
): T {
  const weights = values.map(weightOf);
  let target = random() * weights.reduce((total, weight) => total + weight, 0);
  for (const [index, weight] of weights.entries()) {
    target -= weight;
    if (target < 0) {
      return values[index]!;
    }
  }
  return values.at(-1)!;
}

/**
 * 外周のマスに島を置く重みの倍率。外周のマスは盤面の内側より多く、そのまま選ぶと外周に沿う橋が増えて、
 * 盤面の枠をなぞる問題になる。
 */
const BORDER_PLACEMENT_WEIGHT = 0.35;

/**
 * 島の多い偶奇の組（行と列の偶奇が同じマス）に島を置く重みの倍率。間が1マスの橋で島を広げると、島が1マスおきの格子に
 * 並びやすいので、多い組のマスを選びにくくして、間が偶数マスの橋も混ぜる。
 */
const CROWDED_PARITY_PLACEMENT_WEIGHT = 0.5;

/** 分割で島を差すときに、橋の両端の島から空けるマスの数。差した島が両端の島と隣り合わないようにする。 */
const SPLIT_MARGIN = 2;

function keyOf({ row, column }: CellPosition): number {
  return row * 1_000 + column;
}

function sortRowMajor(cells: readonly CellPosition[]): CellPosition[] {
  return [...cells].sort(
    (left, right) => left.row - right.row || left.column - right.column,
  );
}

function toBoard(
  size: number,
  cells: readonly CellPosition[],
  clues?: readonly number[],
): BridgesBoard {
  return {
    width: size,
    height: size,
    islands: cells.map(
      (cell, index): BridgesIsland => ({ ...cell, clue: clues?.[index] ?? 1 }),
    ),
  };
}

/** 盤面の上下左右の端の行・列のどれにも島があるか。無い外周の行・列があると、盤面の広さが見かけだけになる。 */
function reachesEveryBorder(
  cells: readonly CellPosition[],
  size: number,
): boolean {
  const last = size - 1;
  return (
    cells.some(({ row }) => row === 0) &&
    cells.some(({ row }) => row === last) &&
    cells.some(({ column }) => column === 0) &&
    cells.some(({ column }) => column === last)
  );
}

/**
 * 島と橋を置いていく途中の盤面。島の位置と、架けた橋（島の番号の組と本数）、橋の通るマスを持つ。
 */
class SpreadLayout {
  readonly cells: CellPosition[] = [];
  /** 架けた橋。`path` は `from` の島の側から `to` の島の側へ並べた、間のマス。 */
  readonly bridges: { from: number; to: number; path: CellPosition[] }[] = [];
  private readonly islandIndex = new Map<number, number>();
  private readonly bridgeCells = new Set<number>();

  constructor(readonly size: number) {}

  /** 行と列の偶奇が `cell` と同じ島の数が、偶奇の4つの組の平均より多いか。 */
  isParityCrowded(cell: CellPosition): boolean {
    const parityOf = ({ row, column }: CellPosition) =>
      (row % 2) * 2 + (column % 2);
    const target = parityOf(cell);
    const same = this.cells.filter(
      (other) => parityOf(other) === target,
    ).length;
    return same * 4 > this.cells.length;
  }

  isOnBorder({ row, column }: CellPosition): boolean {
    const last = this.size - 1;
    return row === 0 || row === last || column === 0 || column === last;
  }

  isInside({ row, column }: CellPosition): boolean {
    return row >= 0 && row < this.size && column >= 0 && column < this.size;
  }

  islandAt(cell: CellPosition): number | undefined {
    return this.islandIndex.get(keyOf(cell));
  }

  isBridgeCell(cell: CellPosition): boolean {
    return this.bridgeCells.has(keyOf(cell));
  }

  isAwayFromIslands(cell: CellPosition): boolean {
    return directionSteps.every(
      (step) =>
        this.islandAt({
          row: cell.row + step.row,
          column: cell.column + step.column,
        }) === undefined,
    );
  }

  canHoldIsland(cell: CellPosition): boolean {
    return (
      this.islandAt(cell) === undefined &&
      !this.isBridgeCell(cell) &&
      this.isAwayFromIslands(cell)
    );
  }

  addIsland(cell: CellPosition): number {
    this.bridgeCells.delete(keyOf(cell));
    this.cells.push(cell);
    this.islandIndex.set(keyOf(cell), this.cells.length - 1);
    return this.cells.length - 1;
  }

  addBridge(from: number, to: number, path: CellPosition[]): void {
    for (const cell of path) {
      this.bridgeCells.add(keyOf(cell));
    }
    this.bridges.push({ from, to, path });
  }

  /**
   * 空きマス `cell` から縦横にまっすぐ見て、橋の通るマスを横切らずに最初に出会う島と、その間のマス（`cell` の側から並べる）。
   * 隣のマスの島（間が無い）は数えない。
   */
  listAnchors(cell: CellPosition): Placement[] {
    return directionSteps.flatMap((step) => {
      const path: CellPosition[] = [];
      for (
        let next = {
          row: cell.row + step.row,
          column: cell.column + step.column,
        };
        this.isInside(next) && !this.isBridgeCell(next);
        next = { row: next.row + step.row, column: next.column + step.column }
      ) {
        const anchor = this.islandAt(next);
        if (anchor !== undefined) {
          return path.length > 0 ? [{ cell, anchor, path }] : [];
        }
        path.push(next);
      }
      return [];
    });
  }

  /** 既にある島へまっすぐ橋を架けられる空きマスすべて。盤面のどこも同じ重みで選べるよう、マスごとに1つにまとめる。 */
  listPlacements(): Placement[][] {
    const placements: Placement[][] = [];
    for (let row = 0; row < this.size; row += 1) {
      for (let column = 0; column < this.size; column += 1) {
        const cell = { row, column };
        if (!this.canHoldIsland(cell)) {
          continue;
        }
        const anchors = this.listAnchors(cell);
        if (anchors.length > 0) {
          placements.push(anchors);
        }
      }
    }
    return placements;
  }
}

/**
 * 架けた橋の途中（両端の島から2マス以上離れた、ほかの島と隣り合わないマス）に島を差し、橋を同じ本数の2本に分ける。
 * 島が橋の通り道になる形を作る。差せなければ何もしない。
 */
function splitBridge(layout: SpreadLayout, random: ProblemRandom): void {
  const index = Math.floor(random() * layout.bridges.length);
  const bridge = layout.bridges[index]!;
  const options = bridge.path
    .slice(SPLIT_MARGIN - 1, bridge.path.length - (SPLIT_MARGIN - 1))
    .filter((cell) => layout.isAwayFromIslands(cell));
  if (options.length === 0) {
    return;
  }
  const middle = pickProblemValue(options, random);
  const position = bridge.path.findIndex(
    (cell) => keyOf(cell) === keyOf(middle),
  );
  const island = layout.addIsland(middle);
  layout.bridges.splice(
    index,
    1,
    { from: bridge.from, to: island, path: bridge.path.slice(0, position) },
    { from: island, to: bridge.to, path: bridge.path.slice(position + 1) },
  );
}

/**
 * 盤面全体に島を広げながら、全島をつなぐ橋を張る。
 * 1. 島を1つ置く。以降、既にある島へ縦横にまっすぐ、架けた橋を横切らずに橋を架けられる空きマスを盤面全体から1つ選んで島を置き、
 *    その間に橋を架ける。マスは、架けられる橋の間のマスの数の平方根と、架けられる向きの数に比べた重みで選び、外周のマスは
 *    重みを下げる。伸ばす元の島ではなく置くマスを選ぶので外周に偏らず、短い橋と行き先の少ない島に偏らない
 *    （マスの重みを長さそのものにすると、長い橋が盤面を塞いで島の数が減る）。選んだマスからどの島へ架けるかは、
 *    間のマスの数に比べた重みで選び、長い橋を優先する。
 * 2. 島を置く代わりに、`splitRate` の確率で、架けた橋の途中に島を差して2本に分ける（同じ本数の橋が島を通り抜ける形）。
 *    置いた島から別の向きにも既にある島へ架けられるなら、その向きごとに `extraBridgeRate` の確率で橋を足して輪を作る。
 * 3. 置ける所が尽きるまで続ける。島の多い偶奇の組のマスは選びにくくする。
 * 4. まだ架けていない辺のうち、架けた橋と交わらない辺を `extraBridgeRate` の確率で足して輪を作る。
 * 5. 橋を `doubleBridgeRate` の確率で2本にし、数字は島から出る橋の本数にする。
 * 島の数が下限（`islandDensity` × マスの数）に届かないか、外周の行・列に島の無いものがあれば `null`。
 */
export function spreadBridgesIslands(
  {
    size,
    islandDensity,
    doubleBridgeRate,
    extraBridgeRate,
    splitRate,
  }: BridgesSpreadConditions,
  random: ProblemRandom,
): BridgesCompletedLayout | null {
  const minimumIslandCount = Math.max(
    2,
    Math.ceil(islandDensity * size * size),
  );
  const layout = new SpreadLayout(size);
  layout.addIsland({
    row: Math.floor(random() * size),
    column: Math.floor(random() * size),
  });
  for (;;) {
    if (layout.bridges.length > 0 && random() < splitRate) {
      const before = layout.cells.length;
      splitBridge(layout, random);
      if (layout.cells.length > before) {
        continue;
      }
    }
    const placements = layout.listPlacements();
    if (placements.length === 0) {
      break;
    }
    const anchors = pickWeighted(
      placements,
      random,
      (options) =>
        Math.sqrt(Math.max(...options.map(({ path }) => path.length))) *
        options.length *
        (layout.isOnBorder(options[0]!.cell) ? BORDER_PLACEMENT_WEIGHT : 1) *
        (layout.isParityCrowded(options[0]!.cell)
          ? CROWDED_PARITY_PLACEMENT_WEIGHT
          : 1),
    );
    const first = pickWeighted(anchors, random, ({ path }) => path.length);
    const island = layout.addIsland(first.cell);
    layout.addBridge(first.anchor, island, [...first.path].reverse());
    for (const { anchor, path } of anchors) {
      if (
        anchor !== first.anchor &&
        random() < extraBridgeRate &&
        path.every((cell) => !layout.isBridgeCell(cell))
      ) {
        layout.addBridge(anchor, island, [...path].reverse());
      }
    }
  }
  if (
    layout.cells.length < minimumIslandCount ||
    !reachesEveryBorder(layout.cells, size)
  ) {
    return null;
  }

  const ordered = sortRowMajor(layout.cells);
  const boardIndexOf = new Map(
    ordered.map((cell, index) => [keyOf(cell), index]),
  );
  const toBoardIndex = (island: number) =>
    boardIndexOf.get(keyOf(layout.cells[island]!))!;
  const board = toBoard(size, ordered);
  const { edges, crossingEdges } = getBridgesNetwork(board);
  const edgeByPair = new Map(
    edges.map(({ from, to }, edge) => [`${from}:${to}`, edge]),
  );
  const chosen = new Set(
    layout.bridges.map(({ from, to }) => {
      const [low, high] = [toBoardIndex(from), toBoardIndex(to)].sort(
        (left, right) => left - right,
      );
      const edge = edgeByPair.get(`${low}:${high}`);
      if (edge === undefined) {
        throw new Error("A spread bridge is not between facing islands");
      }
      return edge;
    }),
  );
  for (const edge of edges.keys()) {
    if (
      !chosen.has(edge) &&
      random() < extraBridgeRate &&
      !crossingEdges[edge]!.some((crossing) => chosen.has(crossing))
    ) {
      chosen.add(edge);
    }
  }
  const solution = edges.map((_, edge) =>
    chosen.has(edge) ? (random() < doubleBridgeRate ? 2 : 1) : 0,
  );
  const clues = board.islands.map(() => 0);
  for (const [edge, { from, to }] of edges.entries()) {
    clues[from]! += solution[edge]!;
    clues[to]! += solution[edge]!;
  }
  return { board: toBoard(size, ordered, clues), solution };
}
