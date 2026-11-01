import type {
  IceFloorMazeBoard,
  IceFloorMazeCell,
} from "@/games/ice-floor-maze/puzzle/board";
import { iceFloorMazeCells } from "@/games/ice-floor-maze/puzzle/board";
import { ICE_FLOOR_MAZE_STATE_LIMIT } from "@/games/ice-floor-maze/puzzle/state-graph";

/**
 * 生成と難易度分析で使う、型付き配列の盤面と状態のグラフ。研究用の生成 v4
 * （`scripts/research/ice_floor_hardest_generation_experiment.py` の `Rules`・`explore`）と同じ手と状態を求める。
 * プレイ中の規則（`puzzle/rules.ts`・`puzzle/state-graph.ts`）と同じ動きで、山登りで何万回も解くために数で持つ。
 */

/** マスの種類の番号。`iceFloorMazeCells` の順。 */
export const CELL_ICE = 0;
export const CELL_ROCK = 1;
export const CELL_BRITTLE = 2;
export const CELL_THIN = 3;
export const CELL_OUTSIDE = 4;

/** 方向の番号。0=上、1=右、2=下、3=左（`iceFloorMazeDirections` の順）。 */
export const DIRECTION_COUNT = 4;
const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;

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

const notationByCode = [".", "#", "b", "c", "x"] as const;

/** 1行を1文字列とした記法（`.` `#` `b` `c` `x`）。 */
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
 * 盤面の規則を数で持ったもの。要素（もろい岩・薄い氷）に番号を振り、状態は
 * `変化した要素のビット列 × マス数 + 駒の位置` の数で表す。
 * - `beyond[d][c]`: マス `c` の `d` 方向の隣のマス。外壁なら -1。
 * - `fixedStopper[c]`: 岩か盤面の外で、どの状態でも止め役。
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
  beyond: readonly Int32Array[];
  delta: readonly number[];
  fixedStopper: Uint8Array;
};

/** 状態を数で表せる要素の数（ビット演算を32ビットに収める）。 */
const MAXIMUM_ELEMENT_COUNT = 30;

export function createElementRules(board: GenerationBoard): ElementRules {
  const { width, height, cells } = board;
  const cellCount = width * height;
  const elementCells: number[] = [];
  const elementOf = new Int32Array(cellCount).fill(-1);
  const fixedStopper = new Uint8Array(cellCount);
  for (let cell = 0; cell < cellCount; cell += 1) {
    const code = cells[cell]!;
    if (code === CELL_BRITTLE || code === CELL_THIN) {
      elementOf[cell] = elementCells.length;
      elementCells.push(cell);
    } else if (code === CELL_ROCK || code === CELL_OUTSIDE) {
      fixedStopper[cell] = 1;
    }
  }
  if (elementCells.length > MAXIMUM_ELEMENT_COUNT) {
    throw new RangeError("Ice floor maze board has too many elements");
  }
  const elements = Int32Array.from(elementCells);
  const kinds = Uint8Array.from(elementCells, (cell) => cells[cell]!);
  let brittleBits = 0;
  let thinBits = 0;
  kinds.forEach((kind, element) => {
    if (kind === CELL_BRITTLE) {
      brittleBits |= 1 << element;
    } else {
      thinBits |= 1 << element;
    }
  });
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
    brittleBits,
    thinBits,
    beyond,
    delta: DX.map((dx, direction) => DY[direction]! * width + dx),
    fixedStopper,
  };
}

/** 変化の組 `mask` の盤面で、マス `cell` が止め役か。崩れていないもろい岩と、割れた薄い氷（水面）は止め役。 */
function isStopperCell(
  rules: ElementRules,
  cell: number,
  mask: number,
): boolean {
  if (rules.fixedStopper[cell] === 1) {
    return true;
  }
  const element = rules.elementOf[cell]!;
  if (element < 0) {
    return false;
  }
  const changed = ((mask >>> element) & 1) === 1;
  return rules.kinds[element] === CELL_BRITTLE ? !changed : changed;
}

/** 変化の組 `mask` の盤面で、`position` から `direction` へ滑って止まるマス。動けなければ `position`。 */
export function findSlideEnd(
  rules: ElementRules,
  position: number,
  mask: number,
  direction: number,
): number {
  const beyond = rules.beyond[direction]!;
  let current = position;
  let next = beyond[current]!;
  while (next >= 0 && !isStopperCell(rules, next, mask)) {
    current = next;
    next = beyond[current]!;
  }
  return current;
}

/** `position` から `end` への滑りの後の変化の組。止めたもろい岩が崩れ、出発マスと通過したマスの薄い氷が割れる。 */
export function maskAfterSlide(
  rules: ElementRules,
  position: number,
  end: number,
  mask: number,
  direction: number,
): number {
  let after = mask;
  const hit = rules.beyond[direction]![end]!;
  if (hit >= 0) {
    const element = rules.elementOf[hit]!;
    if (element >= 0 && rules.kinds[element] === CELL_BRITTLE) {
      after |= 1 << element;
    }
  }
  if (rules.thinBits !== 0) {
    const step = rules.delta[direction]!;
    for (let cell = position; cell !== end; cell += step) {
      const element = rules.elementOf[cell]!;
      if (element >= 0 && rules.kinds[element] === CELL_THIN) {
        after |= 1 << element;
      }
    }
  }
  return after;
}

/**
 * 起点から幅優先でたどった状態のグラフ。状態の番号は幅優先の順で、0 が起点。
 * - `positions` / `masks`: 状態の駒の位置と変化の組。
 * - `distances`: 起点からの最少手数。
 * - `targets[4 * s + d]`: 状態 `s` から `d` 方向へ滑った先の状態。動けない向きとゴールで止まった状態は -1。
 */
export type StateSpace = {
  rules: ElementRules;
  goal: number;
  count: number;
  positions: Int32Array;
  masks: Int32Array;
  distances: Int32Array;
  targets: Int32Array;
};

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
 * 起点の状態（駒の位置 `start`、変化の組 `startMask`）から状態をたどる。`goal` で止まった状態の先はたどらない（-1 はゴール無し）。
 * 状態の数が `limit` を超えたら `null`。
 */
export function exploreStateSpace(
  rules: ElementRules,
  start: number,
  {
    goal = -1,
    limit = ICE_FLOOR_MAZE_STATE_LIMIT,
    startMask = 0,
  }: { goal?: number; limit?: number; startMask?: number } = {},
): StateSpace | null {
  const { cellCount } = rules;
  const positions = new GrowableInt32(256);
  const masks = new GrowableInt32(256);
  const distances = new GrowableInt32(256);
  const targets = new GrowableInt32(1024);
  const indexByKey = new Map<number, number>();
  positions.push(start);
  masks.push(startMask);
  distances.push(0);
  indexByKey.set(startMask * cellCount + start, 0);

  for (let order = 0; order < positions.length; order += 1) {
    const position = positions.values[order]!;
    const mask = masks.values[order]!;
    if (position === goal) {
      for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
        targets.push(-1);
      }
      continue;
    }
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const end = findSlideEnd(rules, position, mask, direction);
      if (end === position) {
        targets.push(-1);
        continue;
      }
      const after = maskAfterSlide(rules, position, end, mask, direction);
      const key = after * cellCount + end;
      let target = indexByKey.get(key);
      if (target === undefined) {
        target = positions.length;
        if (target >= limit) {
          return null;
        }
        indexByKey.set(key, target);
        positions.push(end);
        masks.push(after);
        distances.push(distances.values[order]! + 1);
      }
      targets.push(target);
    }
  }

  return {
    rules,
    goal,
    count: positions.length,
    positions: positions.toArray(),
    masks: masks.toArray(),
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
  const masks = new Int32Array(count);
  const targets = new Int32Array(count * DIRECTION_COUNT).fill(-1);
  for (let index = 0; index < count; index += 1) {
    const old = order.values[index]!;
    positions[index] = free.positions[old]!;
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
    goal,
    count,
    positions,
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

/** 手を順に入力し、駒がゴールで止まればクリア。動かない入力は何も起こさない（v3 の `replay`）。 */
export function replaySolution(
  rules: ElementRules,
  start: number,
  moves: readonly number[],
  goal: number,
): boolean {
  let position = start;
  let mask = 0;
  for (const direction of moves) {
    const end = findSlideEnd(rules, position, mask, direction);
    if (end === position) {
      continue;
    }
    mask = maskAfterSlide(rules, position, end, mask, direction);
    position = end;
    if (position === goal) {
      return true;
    }
  }
  return false;
}

/** 到達できる全状態で、駒が通過・停止するマス（v3 の `used_cells`）。 */
export function findUsedCells(space: StateSpace): Uint8Array {
  const { rules, count, positions, targets } = space;
  const used = new Uint8Array(rules.cellCount);
  for (let state = 0; state < count; state += 1) {
    const origin = positions[state]!;
    used[origin] = 1;
    for (let direction = 0; direction < DIRECTION_COUNT; direction += 1) {
      const target = targets[state * DIRECTION_COUNT + direction]!;
      if (target < 0) {
        continue;
      }
      const end = positions[target]!;
      const step = rules.delta[direction]!;
      for (let cell = origin; cell !== end; cell += step) {
        used[cell] = 1;
      }
      used[end] = 1;
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
