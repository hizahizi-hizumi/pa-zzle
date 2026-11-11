import {
  type BridgesBoard,
  type BridgesIsland,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { type ProblemRandom, pickProblemValue } from "@/games/problem-seed";

/**
 * 島を広げる条件。生成条件（`BridgesGenerationConditions`）のうち広げ方に使う値で、問題集の値に限らない。
 * - `islandDensity`: 置く島の数の、盤面のマスに対する割合。島の数は `ceil(islandDensity × マスの数)` ちょうどにする。
 * - `pointSymmetric`: 島の配置を盤面の中心について点対称にする。
 */
export type BridgesSpreadConditions = {
  size: number;
  islandDensity: number;
  doubleBridgeRate: number;
  extraBridgeRate: number;
  splitRate: number;
  pointSymmetric?: boolean;
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

/**
 * 斜め隣に島のあるマスに島を置く重みの倍率。間が1マスの橋で広げると、島が斜めに並んで市松に固まり、行き先が隣の島ばかりの
 * 盤面になるので、斜め隣の空いたマスを選びやすくする。
 */
const DIAGONAL_PLACEMENT_WEIGHT = 0.1;

/** 斜め隣に島のある島の割合の上限。超える配置は、磨く前に作り直す（どのレベルもこの上限を求める）。 */
const MAXIMUM_DIAGONAL_NEIGHBOR_SHARE = 0.5;

const CELL_LENGTH_EXPONENT = 0.5;
const ANCHOR_LENGTH_EXPONENT = 2;

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

  /** 斜め隣のマスに島があるか。 */
  hasDiagonalIsland({ row, column }: CellPosition): boolean {
    return [-1, 1].some((rowStep) =>
      [-1, 1].some(
        (columnStep) =>
          this.islandAt({ row: row + rowStep, column: column + columnStep }) !==
          undefined,
      ),
    );
  }

  /** 盤面の中心について点対称のマス。 */
  mirrorOf({ row, column }: CellPosition): CellPosition {
    return { row: this.size - 1 - row, column: this.size - 1 - column };
  }

  /**
   * `placement` と、その点対称の置き方。点対称の置き方が今の盤面で置けなければ `null`。中心のマスなら置き方は1つ。
   * 2つの島と2本の橋が互いに隣り合ったり交わったりしないことも確かめる。
   */
  mirrorPlacement(placement: Placement): Placement[] | null {
    const cell = this.mirrorOf(placement.cell);
    if (keyOf(cell) === keyOf(placement.cell)) {
      return [placement];
    }
    const anchor = this.islandAt(this.mirrorOf(this.cells[placement.anchor]!));
    if (anchor === undefined || !this.canHoldIsland(cell)) {
      return null;
    }
    const path = placement.path.map((step) => this.mirrorOf(step));
    const taken = new Set([
      keyOf(placement.cell),
      ...placement.path.map(keyOf),
    ]);
    const touches =
      Math.abs(cell.row - placement.cell.row) +
        Math.abs(cell.column - placement.cell.column) <=
      1;
    if (
      touches ||
      taken.has(keyOf(cell)) ||
      path.some(
        (step) =>
          taken.has(keyOf(step)) ||
          this.isBridgeCell(step) ||
          this.islandAt(step) !== undefined,
      )
    ) {
      return null;
    }
    return [placement, { cell, anchor, path }];
  }

  /** マス `cell` を通る橋の番号。無ければ -1。 */
  findBridgeThrough(cell: CellPosition): number {
    return this.bridges.findIndex(({ path }) =>
      path.some((step) => keyOf(step) === keyOf(cell)),
    );
  }

  /** 島 `from` と `to` の間に架けた橋の番号。無ければ -1。 */
  findBridge(from: number, to: number): number {
    return this.bridges.findIndex(
      (bridge) =>
        (bridge.from === from && bridge.to === to) ||
        (bridge.from === to && bridge.to === from),
    );
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
function splitBridge(
  layout: SpreadLayout,
  random: ProblemRandom,
  pointSymmetric: boolean,
): void {
  const index = Math.floor(random() * layout.bridges.length);
  const bridge = layout.bridges[index]!;
  const options = bridge.path
    .slice(SPLIT_MARGIN - 1, bridge.path.length - (SPLIT_MARGIN - 1))
    .filter((cell) => layout.isAwayFromIslands(cell));
  if (options.length === 0) {
    return;
  }
  const middle = pickProblemValue(options, random);
  if (!pointSymmetric) {
    splitAt(layout, index, middle);
    return;
  }
  const mirror = layout.mirrorOf(middle);
  if (keyOf(mirror) === keyOf(middle)) {
    splitAt(layout, index, middle);
    return;
  }
  const mirrorIndex = layout.findBridge(
    layout.islandAt(layout.mirrorOf(layout.cells[bridge.from]!))!,
    layout.islandAt(layout.mirrorOf(layout.cells[bridge.to]!))!,
  );
  const touches =
    Math.abs(mirror.row - middle.row) +
      Math.abs(mirror.column - middle.column) <=
    1;
  if (
    mirrorIndex < 0 ||
    mirrorIndex === index ||
    touches ||
    !layout.isAwayFromIslands(mirror)
  ) {
    return;
  }
  splitAt(layout, index, middle);
  splitAt(layout, layout.findBridgeThrough(mirror), mirror);
}

/** 架けた橋 `index` の途中のマス `middle` に島を差し、橋を2本に分ける。 */
function splitAt(
  layout: SpreadLayout,
  index: number,
  middle: CellPosition,
): void {
  const bridge = layout.bridges[index]!;
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
 * 選んだ辺 `chosen` で島がつながっていなければ、`canAdd` の辺を足してつなぐ。つなげなければ `false`。
 */
function connectChosenEdges(
  islandCount: number,
  edges: readonly { from: number; to: number }[],
  chosen: Set<number>,
  canAdd: (edge: number) => boolean,
): boolean {
  const parent = Array.from({ length: islandCount }, (_, island) => island);
  const find = (island: number): number => {
    while (parent[island] !== island) {
      island = parent[island]!;
    }
    return island;
  };
  for (const edge of chosen) {
    parent[find(edges[edge]!.from)] = find(edges[edge]!.to);
  }
  let groups = new Set(parent.map((_, island) => find(island))).size;
  for (const [edge, { from, to }] of edges.entries()) {
    if (groups === 1) {
      break;
    }
    if (find(from) !== find(to) && canAdd(edge)) {
      chosen.add(edge);
      parent[find(from)] = find(to);
      groups -= 1;
    }
  }
  return groups === 1;
}

/**
 * 盤面全体に島を広げながら、全島をつなぐ橋を張る。
 * 1. 島を1つ置く。以降、既にある島へ縦横にまっすぐ、架けた橋を横切らずに橋を架けられる空きマスを盤面全体から1つ選んで島を置き、
 *    その間に橋を架ける。マスは、架けられる橋の間のマスの数の平方根と、架けられる向きの数に比べた重みで選び、外周のマス・
 *    島の多い偶奇の組のマス・斜め隣に島のあるマスは重みを下げる。伸ばす元の島ではなく置くマスを選ぶので外周に偏らず、
 *    短い橋と行き先の少ない島に偏らない（マスの重みを長さそのものにすると、長い橋が盤面を塞いで島の数が減る）。選んだマスから
 *    どの島へ架けるかは、間のマスの数に比べた重みで選び、長い橋を優先する。
 * 2. 島を置く代わりに、`splitRate` の確率で、架けた橋の途中に島を差して2本に分ける（同じ本数の橋が島を通り抜ける形）。
 *    置いた島から別の向きにも既にある島へ架けられるなら、その向きごとに `extraBridgeRate` の確率で橋を足して輪を作る。
 * 3. 島の数が `ceil(islandDensity × マスの数)` に届くまで続ける（点対称なら2つずつ置くので、1つ多くなることがある）。
 * 4. `pointSymmetric` なら、1〜3 の島と橋を、盤面の中心について点対称の位置にも同時に置く（置けない置き方は選ばない）。
 *    点対称の2つのまとまりは、つながっていなければ、交わらない辺でつなぐ。
 * 5. まだ架けていない辺のうち、架けた橋と交わらない辺を `extraBridgeRate` の確率で足して輪を作る。
 * 6. 橋を `doubleBridgeRate` の確率で2本にし、数字は島から出る橋の本数にする。
 * 置ける所が尽きて島の数に届かないか、外周の行・列に島の無いもの、斜め隣に島のある島が半分を超えるもの、全島をつなげない
 * ものは `null`。
 */
export function spreadBridgesIslands(
  {
    size,
    islandDensity,
    doubleBridgeRate,
    extraBridgeRate,
    splitRate,
    pointSymmetric = false,
  }: BridgesSpreadConditions,
  random: ProblemRandom,
): BridgesCompletedLayout | null {
  const targetIslandCount = Math.max(2, Math.ceil(islandDensity * size * size));
  const layout = new SpreadLayout(size);
  const start = {
    row: Math.floor(random() * size),
    column: Math.floor(random() * size),
  };
  layout.addIsland(start);
  const startMirror = layout.mirrorOf(start);
  if (
    pointSymmetric &&
    keyOf(startMirror) !== keyOf(start) &&
    layout.canHoldIsland(startMirror)
  ) {
    layout.addIsland(startMirror);
  }
  while (layout.cells.length < targetIslandCount) {
    if (layout.bridges.length > 0 && random() < splitRate) {
      const before = layout.cells.length;
      splitBridge(layout, random, pointSymmetric);
      if (layout.cells.length > before) {
        continue;
      }
    }
    const placements = layout.listPlacements().flatMap((anchors) => {
      const usable = pointSymmetric
        ? anchors.filter(
            (placement) => layout.mirrorPlacement(placement) !== null,
          )
        : anchors;
      return usable.length > 0 ? [usable] : [];
    });
    if (placements.length === 0) {
      break;
    }
    const anchors = pickWeighted(
      placements,
      random,
      (options) =>
        Math.max(...options.map(({ path }) => path.length)) **
          CELL_LENGTH_EXPONENT *
        options.length *
        (layout.isOnBorder(options[0]!.cell) ? BORDER_PLACEMENT_WEIGHT : 1) *
        (layout.isParityCrowded(options[0]!.cell)
          ? CROWDED_PARITY_PLACEMENT_WEIGHT
          : 1) *
        (layout.hasDiagonalIsland(options[0]!.cell)
          ? DIAGONAL_PLACEMENT_WEIGHT
          : 1),
    );
    const first = pickWeighted(
      anchors,
      random,
      ({ path }) => path.length ** ANCHOR_LENGTH_EXPONENT,
    );
    const placed = pointSymmetric ? layout.mirrorPlacement(first)! : [first];
    const islands = placed.map((placement) => {
      const island = layout.addIsland(placement.cell);
      layout.addBridge(placement.anchor, island, [...placement.path].reverse());
      return island;
    });
    for (const { anchor, path } of anchors) {
      if (
        anchor === first.anchor ||
        random() >= extraBridgeRate ||
        path.some((cell) => layout.isBridgeCell(cell))
      ) {
        continue;
      }
      layout.addBridge(anchor, islands[0]!, [...path].reverse());
      const mirrorAnchor = layout.islandAt(
        layout.mirrorOf(layout.cells[anchor]!),
      );
      const mirrorPath = path.map((cell) => layout.mirrorOf(cell));
      if (
        islands.length === 2 &&
        mirrorAnchor !== undefined &&
        mirrorPath.every(
          (cell) =>
            !layout.isBridgeCell(cell) && layout.islandAt(cell) === undefined,
        )
      ) {
        layout.addBridge(mirrorAnchor, islands[1]!, [...mirrorPath].reverse());
      }
    }
  }
  if (
    layout.cells.length < targetIslandCount ||
    layout.cells.length > targetIslandCount + (pointSymmetric ? 1 : 0) ||
    !reachesEveryBorder(layout.cells, size) ||
    (pointSymmetric &&
      layout.cells.some(
        (cell) => layout.islandAt(layout.mirrorOf(cell)) === undefined,
      )) ||
    layout.cells.filter((cell) => layout.hasDiagonalIsland(cell)).length >
      MAXIMUM_DIAGONAL_NEIGHBOR_SHARE * layout.cells.length
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
  const canAdd = (edge: number) =>
    !chosen.has(edge) &&
    !crossingEdges[edge]!.some((crossing) => chosen.has(crossing));
  if (!connectChosenEdges(board.islands.length, edges, chosen, canAdd)) {
    return null;
  }
  for (const edge of edges.keys()) {
    if (canAdd(edge) && random() < extraBridgeRate) {
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
