import type { BridgesGenerationConditions } from "@/games/bridges/problem/problem";
import {
  type BridgesBoard,
  type BridgesIsland,
  bridgesDirections,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { type ProblemRandom, pickProblemValue } from "@/games/problem-seed";

/** 完成した橋の配置から数字を出した盤面と、その配置（辺ごとの本数）。 */
export type BridgesCompletedLayout = {
  board: BridgesBoard;
  solution: readonly number[];
};

type CellPosition = { row: number; column: number };

const directionSteps = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
} as const;

/** 島を伸ばす試みの上限を、島の数の目標の何倍にするか。伸ばせる所が尽きた盤面で止めるための上限。 */
const GROWTH_ATTEMPTS_PER_TARGET_ISLAND = 60;

function keyOf({ row, column }: CellPosition): number {
  return row * 1_000 + column;
}

/**
 * 完成グラフを先に作る。島を1つ置き、既存の島から縦横にまっすぐ伸ばした先の空きマスへ島を足して、その間に橋を架けることを繰り返す
 * （橋の通るマスと、既存の島の上下左右には島を置かない）。木として育つので全島がつながる。
 * 木を育てる途中で、`splitRate` の確率で、既にある橋の途中に島を差して橋を2本に分ける（分割）。
 * 次に、まだ橋の無い島の組のうち、既存の橋と交わらない組に `extraBridgeRate` の確率で輪を作る橋を足す。
 * 橋は `doubleBridgeRate` の確率で2本にし、数字は島から出る橋の本数にする。島が2つに届かなければ `null`。
 */
export function growBridgesIslandTree(
  {
    size,
    islandDensity,
    doubleBridgeRate,
    extraBridgeRate,
    splitRate,
  }: BridgesGenerationConditions,
  random: ProblemRandom,
): BridgesCompletedLayout | null {
  const targetIslandCount = Math.max(
    2,
    Math.round(islandDensity * size * size),
  );
  const islands: CellPosition[] = [];
  const islandKeys = new Set<number>();
  const bridgeCells = new Set<number>();
  const bridgeCounts = new Map<string, number>();
  /** 橋ごとの、通るマス（`origin` の島の側から順に）。分割で橋の途中に島を差すのに使う。 */
  const bridgePaths = new Map<string, CellPosition[]>();

  function isInside({ row, column }: CellPosition): boolean {
    return row >= 0 && row < size && column >= 0 && column < size;
  }

  function isAwayFromIslands(cell: CellPosition): boolean {
    return bridgesDirections.every((direction) => {
      const step = directionSteps[direction];
      return !islandKeys.has(
        keyOf({ row: cell.row + step.row, column: cell.column + step.column }),
      );
    });
  }

  function canPlaceIsland(cell: CellPosition): boolean {
    const key = keyOf(cell);
    return (
      !islandKeys.has(key) && !bridgeCells.has(key) && isAwayFromIslands(cell)
    );
  }

  function addIsland(cell: CellPosition): number {
    islands.push(cell);
    islandKeys.add(keyOf(cell));
    return islands.length - 1;
  }

  function drawBridgeCount(): number {
    return random() < doubleBridgeRate ? 2 : 1;
  }

  /**
   * 既にある橋の途中（両端の島から2マス以上離れたマス）に島を差し、橋を同じ本数の2本に分ける。島の数を増やし、
   * 木を育てるだけでは伸ばせる所が尽きる密度より上へ島を置く。置けなければ `false`。
   */
  function splitBridge(): boolean {
    const keys = [...bridgeCounts.keys()];
    const key = pickProblemValue(keys, random);
    const path = bridgePaths.get(key)!;
    if (path.length < 3) {
      return false;
    }
    const index = 1 + Math.floor(random() * (path.length - 2));
    const cell = path[index]!;
    if (!isAwayFromIslands(cell)) {
      return false;
    }
    const [origin, end] = key.split(":").map(Number) as [number, number];
    const count = bridgeCounts.get(key)!;
    const island = addIsland(cell);
    bridgeCells.delete(keyOf(cell));
    bridgeCounts.delete(key);
    bridgePaths.delete(key);
    bridgeCounts.set(`${origin}:${island}`, count);
    bridgePaths.set(`${origin}:${island}`, path.slice(0, index));
    bridgeCounts.set(`${island}:${end}`, count);
    bridgePaths.set(`${island}:${end}`, path.slice(index + 1));
    return true;
  }

  addIsland({
    row: Math.floor(random() * size),
    column: Math.floor(random() * size),
  });
  for (
    let attempt = 0;
    islands.length < targetIslandCount &&
    attempt < targetIslandCount * GROWTH_ATTEMPTS_PER_TARGET_ISLAND;
    attempt += 1
  ) {
    if (bridgeCounts.size > 0 && random() < splitRate) {
      splitBridge();
      continue;
    }
    const origin = Math.floor(random() * islands.length);
    const step = directionSteps[pickProblemValue(bridgesDirections, random)];
    const run: CellPosition[] = [];
    for (
      let cell = {
        row: islands[origin]!.row + step.row,
        column: islands[origin]!.column + step.column,
      };
      isInside(cell) &&
      !islandKeys.has(keyOf(cell)) &&
      !bridgeCells.has(keyOf(cell));
      cell = { row: cell.row + step.row, column: cell.column + step.column }
    ) {
      run.push(cell);
    }
    if (run.length < 2) {
      continue;
    }
    const options = run
      .map((_, distance) => distance)
      .filter((distance) => distance >= 1 && canPlaceIsland(run[distance]!));
    if (options.length === 0) {
      continue;
    }
    const distance = pickProblemValue(options, random);
    const island = addIsland(run[distance]!);
    const path = run.slice(0, distance);
    for (const cell of path) {
      bridgeCells.add(keyOf(cell));
    }
    bridgeCounts.set(`${origin}:${island}`, drawBridgeCount());
    bridgePaths.set(`${origin}:${island}`, path);
  }
  if (islands.length < 2) {
    return null;
  }

  const order = islands
    .map((cell, index) => ({ cell, index }))
    .sort(
      (left, right) =>
        left.cell.row - right.cell.row || left.cell.column - right.cell.column,
    );
  const boardIndexOf = new Map(
    order.map(({ index }, boardIndex) => [index, boardIndex]),
  );
  const placedIslands: BridgesIsland[] = order.map(({ cell }) => ({
    ...cell,
    clue: 1,
  }));
  const layoutBoard: BridgesBoard = {
    width: size,
    height: size,
    islands: placedIslands,
  };
  const { edges } = getBridgesNetwork(layoutBoard);
  const edgeByPair = new Map(
    edges.map(({ from, to }, edge) => [`${from}:${to}`, edge]),
  );
  const solution = edges.map(() => 0);
  for (const [pair, count] of bridgeCounts) {
    const [origin, island] = pair
      .split(":")
      .map((value) => boardIndexOf.get(Number(value))!);
    const edge = edgeByPair.get(
      `${Math.min(origin!, island!)}:${Math.max(origin!, island!)}`,
    );
    if (edge === undefined) {
      throw new Error("A grown bridge is not between facing islands");
    }
    solution[edge] = count;
  }

  for (const [edge, { from, to }] of edges.entries()) {
    if (solution[edge] !== 0 || random() >= extraBridgeRate) {
      continue;
    }
    const cells = listCellsBetween(placedIslands[from]!, placedIslands[to]!);
    if (cells.some((cell) => bridgeCells.has(keyOf(cell)))) {
      continue;
    }
    for (const cell of cells) {
      bridgeCells.add(keyOf(cell));
    }
    solution[edge] = drawBridgeCount();
  }

  const clues = placedIslands.map(() => 0);
  for (const [edge, { from, to }] of edges.entries()) {
    clues[from]! += solution[edge]!;
    clues[to]! += solution[edge]!;
  }
  return {
    board: {
      width: size,
      height: size,
      islands: placedIslands.map((island, index) => ({
        ...island,
        clue: clues[index]!,
      })),
    },
    solution,
  };
}

/** 同じ行か列の2島の間のマス（両端の島を除く）。 */
function listCellsBetween(
  from: CellPosition,
  to: CellPosition,
): CellPosition[] {
  const cells: CellPosition[] = [];
  for (let row = from.row; row <= to.row; row += 1) {
    for (let column = from.column; column <= to.column; column += 1) {
      const isEnd =
        (row === from.row && column === from.column) ||
        (row === to.row && column === to.column);
      if (!isEnd) {
        cells.push({ row, column });
      }
    }
  }
  return cells;
}
