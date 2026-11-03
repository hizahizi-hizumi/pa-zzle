import type {
  IceFloorMazeBoard,
  IceFloorMazeCell,
} from "@/games/ice-floor-maze/puzzle/board";
import { iceFloorMazeCells } from "@/games/ice-floor-maze/puzzle/board";
import { ICE_FLOOR_MAZE_STATE_LIMIT } from "@/games/ice-floor-maze/puzzle/state-graph";

/**
 * 生成と難易度分析で使う、型付き配列の盤面と状態のグラフ。研究用の生成 v4・v5
 * （`scripts/research/ice_floor_hardest_generation_experiment.py`・`ice_floor_persistent_generation_experiment.py` の
 * `Rules`・`explore`）と同じ手と状態を求める。
 * プレイ中の規則（`puzzle/rules.ts`・`puzzle/state-graph.ts`）と同じ動きで、山登りで何万回も解くために数で持つ。
 */

/** マスの種類の番号。`iceFloorMazeCells` の順。 */
export const CELL_ICE = 0;
export const CELL_ROCK = 1;
export const CELL_BRITTLE = 2;
export const CELL_THIN = 3;
export const CELL_OUTSIDE = 4;
export const CELL_FLOOR = 5;
export const CELL_SNOW = 6;
export const CELL_BLOCK = 7;

/** 方向の番号。0=上、1=右、2=下、3=左（`iceFloorMazeDirections` の順）。 */
export const DIRECTION_COUNT = 4;
const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;

/**
 * 配置の盤面でのマスのふるまい。
 * - `KIND_PASS`: 通れる（氷・割れていない薄い氷・崩れた跡・雪をどけた跡）。
 * - `KIND_FLOOR`: 入るとそこで止まる床。
 * - `KIND_SNOW`: まだ押し出していない雪。入ると押し出すか、押し出せなければ手前で止まる。
 * - `KIND_STOPPER`: 止め役（岩・盤面の外・崩れていないもろい岩・水面・雪山）。
 * - `KIND_BLOCK`: 滑る氷の塊のあるマス（止め役で、押せば動く）。
 */
export const KIND_PASS = 0;
export const KIND_FLOOR = 1;
export const KIND_SNOW = 2;
export const KIND_STOPPER = 3;
export const KIND_BLOCK = 4;

/**
 * マスのふるまいの大分け（研究用 v5 の PASS・STOPIN・BLOCK）。初期盤面からこれが変わったマスを、自分の手で作った地形とみなす。
 */
export const BEHAVIOR_PASS = 0;
export const BEHAVIOR_STOP_IN = 1;
export const BEHAVIOR_STOPPER = 2;

const behaviorByKind = [
  BEHAVIOR_PASS,
  BEHAVIOR_STOP_IN,
  BEHAVIOR_STOP_IN,
  BEHAVIOR_STOPPER,
  BEHAVIOR_STOPPER,
] as const;

export function getBehavior(kind: number): number {
  return behaviorByKind[kind]!;
}

/** 生成で扱う盤面。`cells` はマスの種類の番号。 */
export type GenerationBoard = {
  width: number;
  height: number;
  cells: Uint8Array;
};

export function toGenerationBoard(board: IceFloorMazeBoard): GenerationBoard {
  return {
    width: board.width,
    height: board.height,
    cells: Uint8Array.from(board.cells, (cell) =>
      iceFloorMazeCells.indexOf(cell),
    ),
  };
}

export function fromGenerationBoard(board: GenerationBoard): IceFloorMazeBoard {
  return {
    width: board.width,
    height: board.height,
    cells: Array.from(
      board.cells,
      (code): IceFloorMazeCell => iceFloorMazeCells[code]!,
    ),
  };
}

const notationByCode = [".", "#", "b", "c", "x", "o", "s", "m"] as const;

/** 1行を1文字列とした記法（`.` `#` `b` `c` `x` `o` `s` `m`）。 */
function formatGenerationBoardRows(board: GenerationBoard): string[] {
  return Array.from({ length: board.height }, (_, y) =>
    Array.from(
      board.cells.subarray(y * board.width, (y + 1) * board.width),
      (code) => notationByCode[code]!,
    ).join(""),
  );
}

function parseGenerationBoardRows(rows: readonly string[]): GenerationBoard {
  const width = rows[0]?.length ?? 0;
  const cells = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    Array.from(row).forEach((notation, x) => {
      const code = notationByCode.indexOf(
        notation as (typeof notationByCode)[number],
      );
      if (code < 0) {
        throw new RangeError(`Unknown cell notation: ${notation}`);
      }
      cells[y * width + x] = code;
    });
  });
  return { width, height: rows.length, cells };
}

/**
 * 盤面の規則を数で持ったもの。要素（もろい岩・薄い氷・雪・滑る氷の塊の元のマス）にマスの順で番号を振る。
 * - `brittleBits` / `thinBits` / `snowBits` / `blockBits`: 種類ごとの要素のビット。
 * - `snowSlot[e]`: 雪の要素 `e` の押し出した向きを、配置の `snowDirections` の何番目の2ビットに持つか。雪でなければ -1。
 * - `homes`: 滑る氷の塊の元のマス（昇順）。
 * - `beyond[d][c]`: マス `c` の `d` 方向の隣のマス。外壁なら -1。
 * - `baseKinds[c]`: 初期盤面のマスのふるまい（塊のあるマスは `KIND_BLOCK`）。
 */
export type ElementRules = {
  width: number;
  height: number;
  cellCount: number;
  cells: Uint8Array;
  elements: Int32Array;
  kinds: Uint8Array;
  elementOf: Int32Array;
  brittleBits: number;
  thinBits: number;
  snowBits: number;
  blockBits: number;
  snowSlot: Int32Array;
  homes: Int32Array;
  beyond: readonly Int32Array[];
  delta: readonly number[];
  baseKinds: Uint8Array;
};

/** 状態を数で表せる要素の数（ビット演算を32ビットに収める）。 */
const MAXIMUM_ELEMENT_COUNT = 30;
/** 押し出した向きを1つの数に収められる雪の数（1つ2ビット）。 */
const MAXIMUM_SNOW_COUNT = 15;

const baseKindByCode: readonly number[] = [
  KIND_PASS,
  KIND_STOPPER,
  KIND_STOPPER,
  KIND_PASS,
  KIND_STOPPER,
  KIND_FLOOR,
  KIND_SNOW,
  KIND_BLOCK,
];

export function createElementRules(board: GenerationBoard): ElementRules {
  const { width, height, cells } = board;
  const cellCount = width * height;
  const elementCells: number[] = [];
  const elementOf = new Int32Array(cellCount).fill(-1);
  const baseKinds = new Uint8Array(cellCount);
  for (let cell = 0; cell < cellCount; cell += 1) {
    const code = cells[cell]!;
    baseKinds[cell] = baseKindByCode[code]!;
    if (
      code === CELL_BRITTLE ||
      code === CELL_THIN ||
      code === CELL_SNOW ||
      code === CELL_BLOCK
    ) {
      elementOf[cell] = elementCells.length;
      elementCells.push(cell);
    }
  }
  if (elementCells.length > MAXIMUM_ELEMENT_COUNT) {
    throw new RangeError("Ice floor maze board has too many elements");
  }
  const elements = Int32Array.from(elementCells);
  const kinds = Uint8Array.from(elementCells, (cell) => cells[cell]!);
  const bits = [0, 0, 0, 0, 0, 0, 0, 0];
  const snowSlot = new Int32Array(elementCells.length).fill(-1);
  let snowCount = 0;
  kinds.forEach((kind, element) => {
    bits[kind]! |= 1 << element;
    if (kind === CELL_SNOW) {
      snowSlot[element] = snowCount;
      snowCount += 1;
    }
  });
  if (snowCount > MAXIMUM_SNOW_COUNT) {
    throw new RangeError("Ice floor maze board has too much snow");
  }
  const beyond = Array.from({ length: DIRECTION_COUNT }, (_, direction) => {
    const table = new Int32Array(cellCount);
    for (let cell = 0; cell < cellCount; cell += 1) {
      const x = (cell % width) + DX[direction]!;
      const y = Math.floor(cell / width) + DY[direction]!;
      table[cell] =
        x >= 0 && x < width && y >= 0 && y < height ? y * width + x : -1;
    }
    return table;
  });
  return {
    width,
    height,
    cellCount,
    cells,
    elements,
    kinds,
    elementOf,
    brittleBits: bits[CELL_BRITTLE]!,
    thinBits: bits[CELL_THIN]!,
    snowBits: bits[CELL_SNOW]!,
    blockBits: bits[CELL_BLOCK]!,
    snowSlot,
    homes: Int32Array.from(
      elementCells.filter((cell) => cells[cell] === CELL_BLOCK),
    ),
    beyond,
    delta: DX.map((dx, direction) => DY[direction]! * width + dx),
    baseKinds,
  };
}

/**
 * 盤面の要素の配置（駒の位置を除いた状態）。状態は駒の位置と配置で決まる。
 * - `mask`: 要素ごとの「変化した」ビット。薄い氷は割れた、もろい岩は崩れた、雪は押し出した、塊は元のマスに塊が無い。
 * - `snowDirections`: 押し出した雪の向き（雪ごとに2ビット）。
 * - `blocks`: 塊のあるマス（昇順）。
 * - `kinds`: マスのふるまい（`KIND_*`）。
 */
export type Layout = {
  id: number;
  mask: number;
  snowDirections: number;
  blocks: Int32Array;
  kinds: Uint8Array;
};

/** 配置を番号で引けるようにした表。1つの盤面の状態のグラフどうしで共有する。 */
export type LayoutTable = {
  rules: ElementRules;
  layouts: Layout[];
  idByKey: Map<string, number>;
};

export function createLayoutTable(rules: ElementRules): LayoutTable {
  const initial: Layout = {
    id: 0,
    mask: 0,
    snowDirections: 0,
    blocks: rules.homes,
    kinds: rules.baseKinds,
  };
  return {
    rules,
    layouts: [initial],
    idByKey: new Map([[describeLayout(initial), 0]]),
  };
}

function describeLayout({
  mask,
  snowDirections,
  blocks,
}: Pick<Layout, "mask" | "snowDirections" | "blocks">): string {
  return blocks.length === 0
    ? `${mask}:${snowDirections}`
    : `${mask}:${snowDirections}:${blocks.join(",")}`;
}

/** 押し出した雪の向き。押し出していなければ -1。 */
export function getSnowDirection(
  rules: ElementRules,
  layout: Layout,
  element: number,
): number {
  return ((layout.mask >>> element) & 1) === 1
    ? (layout.snowDirections >>> (2 * rules.snowSlot[element]!)) & 3
    : -1;
}

/**
 * 1手の滑りの結果。`end` は止まったマス（動けなければ出発マス）、`hit` は滑りを止めた止め役（外壁・床に入った・雪を
 * 押し出したなら -1）。`newlyChanged` は割れる薄い氷・崩れるもろい岩・押し出す雪の要素のビット、`snowElement` は押し出す雪、
 * `blockFrom` / `blockTo` は動かす塊の元のマスと止まるマス（動かさなければ -1）。呼ぶたびに書き換える作業用の値。
 */
export type SlideOutcome = {
  end: number;
  hit: number;
  newlyChanged: number;
  snowElement: number;
  blockFrom: number;
  blockTo: number;
};

export function createSlideOutcome(): SlideOutcome {
  return {
    end: -1,
    hit: -1,
    newlyChanged: 0,
    snowElement: -1,
    blockFrom: -1,
    blockTo: -1,
  };
}

/**
 * 配置 `layout` の盤面で、`position` から `direction` へ滑らせる（`puzzle/rules.ts` の `slideIceFloorMazePiece` と同じ規則）。
 * 止まったマスを返し、`outcome` を書き換える。
 */
export function slideInLayout(
  rules: ElementRules,
  layout: Layout,
  position: number,
  direction: number,
  outcome: SlideOutcome,
): number {
  const beyond = rules.beyond[direction]!;
  const { kinds } = layout;
  let current = position;
  let hit = beyond[current]!;
  let snowElement = -1;
  while (hit >= 0) {
    const kind = kinds[hit]!;
    if (kind === KIND_STOPPER || kind === KIND_BLOCK) {
      break;
    }
    if (kind === KIND_SNOW) {
      const ahead = beyond[hit]!;
      if (ahead < 0 || kinds[ahead] !== KIND_PASS) {
        break;
      }
      snowElement = rules.elementOf[hit]!;
    }
    current = hit;
    hit = kind === KIND_PASS ? beyond[current]! : -1;
  }
  outcome.snowElement = snowElement;
  outcome.blockFrom = -1;
  outcome.blockTo = -1;
  if (current === position) {
    outcome.end = position;
    outcome.hit = hit;
    outcome.newlyChanged = 0;
    return position;
  }
  if (hit >= 0 && kinds[hit] === KIND_BLOCK) {
    let blockTo = hit;
    for (
      let next = beyond[blockTo]!;
      next >= 0 && kinds[next] === KIND_PASS;
      next = beyond[blockTo]!
    ) {
      blockTo = next;
    }
    if (blockTo !== hit) {
      outcome.blockFrom = hit;
      outcome.blockTo = blockTo;
      current = blockTo - rules.delta[direction]!;
      hit = blockTo;
    }
  }
  let newlyChanged = snowElement >= 0 ? 1 << snowElement : 0;
  if (hit >= 0) {
    const element = rules.elementOf[hit]!;
    if (
      element >= 0 &&
      rules.kinds[element] === CELL_BRITTLE &&
      kinds[hit] === KIND_STOPPER
    ) {
      newlyChanged |= 1 << element;
    }
  }
  if (rules.thinBits !== 0) {
    const step = rules.delta[direction]!;
    for (let cell = position; cell !== current; cell += step) {
      const element = rules.elementOf[cell]!;
      if (element >= 0 && rules.kinds[element] === CELL_THIN) {
        newlyChanged |= 1 << element;
      }
    }
  }
  outcome.end = current;
  outcome.hit = hit;
  outcome.newlyChanged = newlyChanged & ~layout.mask;
  return current;
}

/** 滑りの後の配置。何も変わらなければ `layout` を返す。 */
export function applySlideToLayout(
  table: LayoutTable,
  layout: Layout,
  direction: number,
  outcome: SlideOutcome,
): Layout {
  const { newlyChanged, blockFrom, blockTo } = outcome;
  if (newlyChanged === 0 && blockFrom < 0) {
    return layout;
  }
  const { rules } = table;
  let { mask, snowDirections, blocks } = layout;
  mask |= newlyChanged;
  if (outcome.snowElement >= 0) {
    snowDirections |= direction << (2 * rules.snowSlot[outcome.snowElement]!);
  }
  if (blockFrom >= 0) {
    blocks = Int32Array.from(blocks, (cell) =>
      cell === blockFrom ? blockTo : cell,
    ).sort();
    for (let index = 0; index < rules.homes.length; index += 1) {
      const home = rules.homes[index]!;
      const bit = 1 << rules.elementOf[home]!;
      mask = blocks.includes(home) ? mask & ~bit : mask | bit;
    }
  }
  const key = describeLayout({ mask, snowDirections, blocks });
  const known = table.idByKey.get(key);
  if (known !== undefined) {
    return table.layouts[known]!;
  }
  const kinds = layout.kinds.slice();
  for (let element = 0; element < rules.elements.length; element += 1) {
    if (((newlyChanged >>> element) & 1) === 0) {
      continue;
    }
    const cell = rules.elements[element]!;
    const code = rules.kinds[element]!;
    if (code === CELL_THIN) {
      kinds[cell] = KIND_STOPPER;
    } else if (code === CELL_BRITTLE) {
      kinds[cell] = KIND_PASS;
    } else if (code === CELL_SNOW) {
      kinds[cell] = KIND_PASS;
      kinds[rules.beyond[direction]![cell]!] = KIND_STOPPER;
    }
  }
  if (blockFrom >= 0) {
    kinds[blockFrom] = KIND_PASS;
    kinds[blockTo] = KIND_BLOCK;
  }
  const next: Layout = {
    id: table.layouts.length,
    mask,
    snowDirections,
    blocks,
    kinds,
  };
  table.layouts.push(next);
  table.idByKey.set(key, next.id);
  return next;
}

/**
 * 起点から幅優先でたどった状態のグラフ。状態の番号は幅優先の順で、0 が起点。
 * - `positions` / `layoutIds`: 状態の駒の位置と配置の番号（`layouts.layouts` の添字）。
 * - `masks`: 状態の配置の、要素ごとの「変化した」ビット。
 * - `distances`: 起点からの最少手数。
 * - `targets[4 * s + d]`: 状態 `s` から `d` 方向へ滑った先の状態。動けない向きとゴールで止まった状態は -1。
 */
export type StateSpace = {
  rules: ElementRules;
  layouts: LayoutTable;
  goal: number;
  count: number;
  positions: Int32Array;
  layoutIds: Int32Array;
  masks: Int32Array;
  distances: Int32Array;
  targets: Int32Array;
};

/** 状態の配置。 */
export function getLayout(space: StateSpace, state: number): Layout {
  return space.layouts.layouts[space.layoutIds[state]!]!;
}

class GrowableInt32 {
  values: Int32Array;
  length = 0;

  constructor(capacity: number) {
    this.values = new Int32Array(capacity);
  }

  push(value: number): void {
    if (this.length === this.values.length) {
      const grown = new Int32Array(this.values.length * 2);
      grown.set(this.values);
      this.values = grown;
    }
    this.values[this.length] = value;
    this.length += 1;
  }

  toArray(): Int32Array {
    return this.values.slice(0, this.length);
  }
}

/**
 * 起点の状態（駒の位置 `start`、初期の配置）から状態をたどる。`goal` で止まった状態の先はたどらない（-1 はゴール無し）。
 * 状態の数が `limit` を超えたら `null`。
 */
export function exploreStateSpace(
  rules: ElementRules,
  start: number,
  {
    goal = -1,
    limit = ICE_FLOOR_MAZE_STATE_LIMIT,
  }: { goal?: number; limit?: number } = {},
): StateSpace | null {
  const { cellCount } = rules;
  const table = createLayoutTable(rules);
  const outcome = createSlideOutcome();
  const positions = new GrowableInt32(256);
  const layoutIds = new GrowableInt32(256);
  const distances = new GrowableInt32(256);
  const targets = new GrowableInt32(1024);
  const indexByKey = new Map<number, number>();
  positions.push(start);
  layoutIds.push(0);
  distances.push(0);
  indexByKey.set(start, 0);

  for (let order = 0; order < positions.length; order += 1) {
    const position = positions.values[order]!;
    const layout = table.layouts[layoutIds.values[order]!]!;
    if (position === goal) {
      for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
        targets.push(-1);
      }
      continue;
    }
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = slideInLayout(rules, layout, position, direction, outcome);
      if (end === position) {
        targets.push(-1);
        continue;
      }
      const after = applySlideToLayout(table, layout, direction, outcome);
      const key = after.id * cellCount + end;
      let target = indexByKey.get(key);
      if (target === undefined) {
        target = positions.length;
        if (target >= limit) {
          return null;
        }
        indexByKey.set(key, target);
        positions.push(end);
        layoutIds.push(after.id);
        distances.push(distances.values[order]! + 1);
      }
      targets.push(target);
    }
  }

  const layoutIdArray = layoutIds.toArray();
  return {
    rules,
    layouts: table,
    goal,
    count: positions.length,
    positions: positions.toArray(),
    layoutIds: layoutIdArray,
    masks: Int32Array.from(
      layoutIdArray,
      (layoutId) => table.layouts[layoutId]!.mask,
    ),
    distances: distances.toArray(),
    targets: targets.toArray(),
  };
}

/** ゴールを持たない状態のグラフから、`goal` で止まった状態を終わりにしたグラフを作る（v3 の `with_goal`）。 */
export function withGoal(free: StateSpace, goal: number): StateSpace {
  const newIndex = new Int32Array(free.count).fill(-1);
  const order = new GrowableInt32(free.count);
  order.push(0);
  newIndex[0] = 0;
  const distances = new GrowableInt32(free.count);
  distances.push(0);
  for (let cursor = 0; cursor < order.length; cursor += 1) {
    const old = order.values[cursor]!;
    if (free.positions[old] === goal) {
      continue;
    }
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const target = free.targets[old * DIRECTION_COUNT + direction]!;
      if (target >= 0 && newIndex[target]! < 0) {
        newIndex[target] = order.length;
        order.push(target);
        distances.push(distances.values[cursor]! + 1);
      }
    }
  }
  const count = order.length;
  const positions = new Int32Array(count);
  const layoutIds = new Int32Array(count);
  const masks = new Int32Array(count);
  const targets = new Int32Array(count * DIRECTION_COUNT).fill(-1);
  for (let index = 0; index < count; index += 1) {
    const old = order.values[index]!;
    positions[index] = free.positions[old]!;
    layoutIds[index] = free.layoutIds[old]!;
    masks[index] = free.masks[old]!;
    if (positions[index] === goal) {
      continue;
    }
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const target = free.targets[old * DIRECTION_COUNT + direction]!;
      if (target >= 0) {
        targets[index * DIRECTION_COUNT + direction] = newIndex[target]!;
      }
    }
  }
  return {
    rules: free.rules,
    layouts: free.layouts,
    goal,
    count,
    positions,
    layoutIds,
    masks,
    distances: distances.toArray(),
    targets,
  };
}

/** 状態から1手で移れる状態。手の向きの順。 */
export function getTarget(
  space: StateSpace,
  state: number,
  direction: number,
): number {
  return space.targets[state * DIRECTION_COUNT + direction]!;
}

/** 各状態からゴールで止まった状態までの最少手数。ゴールへ止まれない状態は -1（v3 の `reverse_layers`）。 */
export function measureDistancesToGoal(space: StateSpace): Int32Array {
  const { count, targets, positions, goal } = space;
  const predecessorCounts = new Int32Array(count + 1);
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index]!;
    if (target >= 0) {
      predecessorCounts[target + 1]! += 1;
    }
  }
  for (let state = 0; state < count; state += 1) {
    predecessorCounts[state + 1]! += predecessorCounts[state]!;
  }
  const filled = predecessorCounts.slice(0, count);
  const predecessors = new Int32Array(predecessorCounts[count]!);
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index]!;
    if (target >= 0) {
      predecessors[filled[target]!] = Math.floor(index / DIRECTION_COUNT);
      filled[target]! += 1;
    }
  }

  const toGoal = new Int32Array(count).fill(-1);
  const queue = new Int32Array(count);
  let tail = 0;
  for (let state = 0; state < count; state += 1) {
    if (positions[state] === goal) {
      toGoal[state] = 0;
      queue[tail] = state;
      tail += 1;
    }
  }
  for (let head = 0; head < tail; head += 1) {
    const state = queue[head]!;
    for (
      let index = predecessorCounts[state]!;
      index < predecessorCounts[state + 1]!;
      index += 1
    ) {
      const previous = predecessors[index]!;
      if (toGoal[previous]! < 0) {
        toGoal[previous] = toGoal[state]! + 1;
        queue[tail] = previous;
        tail += 1;
      }
    }
  }
  return toGoal;
}

/** 手の番号の小さい手を優先した最短解の向きの列（v3 の `canonical_solution`）。 */
export function findCanonicalSolution(
  space: StateSpace,
  toGoal: Int32Array,
): number[] {
  const moves: number[] = [];
  let state = 0;
  while (toGoal[state]! > 0) {
    const remaining = toGoal[state]!;
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const target = getTarget(space, state, direction);
      if (target >= 0 && toGoal[target] === remaining - 1) {
        moves.push(direction);
        state = target;
        break;
      }
    }
  }
  return moves;
}

/** 最短解の数（v3 の `count_plans`）。状態の番号は起点からの最少手数の順に並ぶ。 */
export function countShortestSolutions(
  space: StateSpace,
  toGoal: Int32Array,
  shortest: number,
): number {
  const { count, distances } = space;
  const ways = new Float64Array(count);
  ways[0] = 1;
  let total = 0;
  for (let state = 0; state < count; state += 1) {
    if (toGoal[state]! < 0 || distances[state]! + toGoal[state]! !== shortest) {
      continue;
    }
    if (toGoal[state] === 0) {
      total += ways[state]!;
      continue;
    }
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const target = getTarget(space, state, direction);
      if (
        target >= 0 &&
        toGoal[target]! >= 0 &&
        distances[target] === distances[state]! + 1 &&
        distances[target]! + toGoal[target]! === shortest
      ) {
        ways[target]! += ways[state]!;
      }
    }
  }
  return total;
}

/** 雪を押し出した滑りなら雪山になったマス、そうでなければ -1。 */
function findMadeMound(
  space: StateSpace,
  source: number,
  target: number,
  direction: number,
): number {
  const pushed =
    space.masks[target]! & ~space.masks[source]! & space.rules.snowBits;
  return pushed === 0
    ? -1
    : space.rules.beyond[direction]![space.positions[target]!]!;
}

/** 塊を動かした滑りなら、動いた塊の元のマスと止まったマス。動かさなければ `null`。 */
export function findMovedBlock(
  space: StateSpace,
  source: number,
  target: number,
): [from: number, to: number] | null {
  const before = getLayout(space, source).blocks;
  const after = getLayout(space, target).blocks;
  if (before === after) {
    return null;
  }
  const from = before.find((cell) => !after.includes(cell));
  const to = after.find((cell) => !before.includes(cell));
  return from === undefined || to === undefined ? null : [from, to];
}

/**
 * 到達できる全状態で、駒が通過・停止するマスと、雪を押し出してできた雪山のマス、滑る氷の塊が通過・停止するマス
 * （研究用 v5 の `used_cells`）。
 */
export function findUsedCells(space: StateSpace): Uint8Array {
  const { rules, count, positions, targets } = space;
  const used = new Uint8Array(rules.cellCount);
  function markPath(origin: number, end: number, direction: number): void {
    const step = rules.delta[direction]!;
    for (let cell = origin; cell !== end; cell += step) {
      used[cell] = 1;
    }
    used[end] = 1;
  }
  for (let state = 0; state < count; state += 1) {
    const origin = positions[state]!;
    used[origin] = 1;
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const target = targets[state * DIRECTION_COUNT + direction]!;
      if (target < 0) {
        continue;
      }
      markPath(origin, positions[target]!, direction);
      if (space.layoutIds[target] === space.layoutIds[state]) {
        continue;
      }
      const mound = findMadeMound(space, state, target, direction);
      if (mound >= 0) {
        used[mound] = 1;
      }
      const moved = findMovedBlock(space, state, target);
      if (moved) {
        markPath(moved[0], moved[1], direction);
      }
    }
  }
  return used;
}

/** 到達できるどこかの状態で変化する要素のビット列（v3 の `touched_elements`）。 */
export function findTouchedElements(space: StateSpace): number {
  let touched = 0;
  for (let state = 0; state < space.count; state += 1) {
    touched |= space.masks[state]!;
  }
  return touched;
}

/**
 * 手の向きの列のうち、`included` の手だけからなる階段（直交する2つの向きを交互に続けた手）の最も長い連なり。
 * 1手だけでも1と数える。
 */
export function measureLongestStair(
  directions: readonly number[],
  included: readonly boolean[],
): number {
  let longest = 0;
  let length = 0;
  directions.forEach((direction, index) => {
    if (!included[index]) {
      length = 0;
      return;
    }
    const previous = directions[index - 1];
    if (
      length === 0 ||
      previous === undefined ||
      previous % 2 === direction % 2
    ) {
      length = 1;
    } else if (length >= 2 && directions[index - 2] !== direction) {
      length = 2;
    } else {
      length += 1;
    }
    longest = Math.max(longest, length);
  });
  return longest;
}

export function countBits(value: number): number {
  let rest = value >>> 0;
  let count = 0;
  while (rest !== 0) {
    rest &= rest - 1;
    count += 1;
  }
  return count;
}

export const _private = { formatGenerationBoardRows, parseGenerationBoardRows };
