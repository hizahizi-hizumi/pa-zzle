import type { MagicSquareGrid } from "@/games/magic-square/problem/generation/solver";
import {
  getMagicSquareLineCellIndices,
  listMagicSquareLines,
} from "@/games/magic-square/puzzle/board";

/**
 * マスの並べ替え。`map[マス] = 写した先のマス`。写した盤面は `out[map[c]] = cells[c]`。
 * - `G`: 縦・横・斜めの列の集まりを列の集まりへ移す並べ替え（列の構造の自己同型）。4×4・5×5 は32、6×6 は192。
 *   回転・裏返しの8通りを含む。どの列の合計も変えないので、魔方陣は魔方陣に、問題は同じ解き方の問題に移る。
 * - `D4`: 回転・裏返しの8通り。
 */
export type MagicSquareSymmetryGroup = "G" | "D4";

type CellMap = readonly number[];

function compareGrids(left: MagicSquareGrid, right: MagicSquareGrid): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function listPermutations(size: number): number[][] {
  if (size === 0) {
    return [[]];
  }
  return listPermutations(size - 1).flatMap((permutation) =>
    Array.from({ length: size }, (_, position) => [
      ...permutation.slice(0, position),
      size - 1,
      ...permutation.slice(position),
    ]),
  );
}

/** 横の並べ替え `rowOrder`・縦の並べ替え `columnOrder`・転置で、マス (r, c) を写す先。 */
function createCellMap(
  size: number,
  rowOrder: readonly number[],
  columnOrder: readonly number[],
  transpose: boolean,
): CellMap {
  return Array.from({ length: size * size }, (_, cellIndex) => {
    const row = rowOrder[Math.floor(cellIndex / size)]!;
    const column = columnOrder[cellIndex % size]!;
    return transpose ? column * size + row : row * size + column;
  });
}

function listLineKeys(size: number): Set<string> {
  return new Set(
    listMagicSquareLines(size).map((line) =>
      getMagicSquareLineCellIndices(size, line)
        .toSorted((left, right) => left - right)
        .join(","),
    ),
  );
}

function preservesLines(
  map: CellMap,
  size: number,
  lineKeys: Set<string>,
): boolean {
  return listMagicSquareLines(size).every((line) =>
    lineKeys.has(
      getMagicSquareLineCellIndices(size, line)
        .map((cellIndex) => map[cellIndex]!)
        .toSorted((left, right) => left - right)
        .join(","),
    ),
  );
}

function sortCellMaps(maps: Iterable<CellMap>): CellMap[] {
  const unique = new Map<string, CellMap>();
  for (const map of maps) {
    unique.set(map.join(","), map);
  }
  return [...unique.values()].toSorted(compareGrids);
}

/**
 * 列の構造の自己同型（辞書順）。
 * n ≥ 4 では、互いに交わらない n 本の列の組は全部の横か全部の縦だけなので、自己同型は
 * （横の並べ替え s、縦の並べ替え t、転置）で表せる。斜めを斜めへ移すには t = s か t = r∘s（r は i → n−1−i）で、
 * s が r と交換する（s(n−1−i) = n−1−s(i)）必要がある。その全部から、列を列へ移すものだけを残す。
 */
function createLineGroup(size: number): CellMap[] {
  const lineKeys = listLineKeys(size);
  const centered = listPermutations(size).filter((order) =>
    order.every((value, index) => order[size - 1 - index] === size - 1 - value),
  );
  const pairs = [
    ...centered.map((order) => [order, order] as const),
    ...centered.map(
      (order) => [order, order.map((value) => size - 1 - value)] as const,
    ),
  ];
  return sortCellMaps(
    [false, true].flatMap((transpose) =>
      pairs
        .map(([rowOrder, columnOrder]) =>
          createCellMap(size, rowOrder, columnOrder, transpose),
        )
        .filter((map) => preservesLines(map, size, lineKeys)),
    ),
  );
}

/** 回転（0〜3回）と、そのあと左右の裏返しをするかの8通り（辞書順）。 */
function createD4Group(size: number): CellMap[] {
  return sortCellMaps(
    Array.from({ length: 8 }, (_, kind) =>
      Array.from({ length: size * size }, (_, cellIndex) => {
        let row = Math.floor(cellIndex / size);
        let column = cellIndex % size;
        for (let turn = 0; turn < kind % 4; turn += 1) {
          [row, column] = [column, size - 1 - row];
        }
        if (kind >= 4) {
          column = size - 1 - column;
        }
        return row * size + column;
      }),
    ),
  );
}

const groups = new Map<string, readonly CellMap[]>();

export function listMagicSquareSymmetries(
  size: number,
  group: MagicSquareSymmetryGroup,
): readonly CellMap[] {
  const key = `${group}:${size}`;
  const cached = groups.get(key);
  if (cached) {
    return cached;
  }
  const created = group === "G" ? createLineGroup(size) : createD4Group(size);
  groups.set(key, created);
  return created;
}

/** `map` で写し、`complement` なら置いた数 v を n²+1−v にする。空き（0）は 0 のまま。 */
export function transformMagicSquareGrid(
  cells: MagicSquareGrid,
  map: CellMap,
  complement = false,
): number[] {
  const out = Array<number>(cells.length).fill(0);
  cells.forEach((value, cellIndex) => {
    out[map[cellIndex]!] =
      complement && value !== 0 ? cells.length + 1 - value : value;
  });
  return out;
}

/**
 * 同型の類の代表。`group` の各元で写した盤面（`complement` なら補数も）を行優先の数の列にし、辞書順で最小のもの。
 */
export function canonicalizeMagicSquareGrid(
  cells: MagicSquareGrid,
  group: MagicSquareSymmetryGroup,
  complement: boolean,
): number[] {
  const size = Math.round(Math.sqrt(cells.length));
  let best: number[] | null = null;
  for (const map of listMagicSquareSymmetries(size, group)) {
    for (const flipped of complement ? [false, true] : [false]) {
      const candidate = transformMagicSquareGrid(cells, map, flipped);
      if (best === null || compareGrids(candidate, best) < 0) {
        best = candidate;
      }
    }
  }
  return best ?? [...cells];
}

/**
 * 問題を見分けるキー。どれも同型の類の代表（行優先の数の列）。
 * - `problem`・`problemD4`: 与える数（空きは 0）の、G × 補数と、回転・裏返しだけでの代表。
 * - `solution`・`solutionD4`: 答えの魔方陣の、同じ2つの代表。
 * - `layout`: 与える数のある所（1）と空き（0）の、G での代表。
 */
export type MagicSquareProblemKeys = {
  problem: readonly number[];
  problemD4: readonly number[];
  solution: readonly number[];
  solutionD4: readonly number[];
  layout: readonly number[];
};

export function createMagicSquareProblemKeys(
  givens: MagicSquareGrid,
  solution: MagicSquareGrid,
): MagicSquareProblemKeys {
  return {
    problem: canonicalizeMagicSquareGrid(givens, "G", true),
    problemD4: canonicalizeMagicSquareGrid(givens, "D4", false),
    solution: canonicalizeMagicSquareGrid(solution, "G", true),
    solutionD4: canonicalizeMagicSquareGrid(solution, "D4", false),
    layout: canonicalizeMagicSquareGrid(
      givens.map((value) => (value === 0 ? 0 : 1)),
      "G",
      false,
    ),
  };
}

/**
 * 答えが同じ類の2問の近さ。a の答えを b の答えへ写す変換（G × 補数）のうち、a の与える数のある所を写した集合と
 * b の与える数のある所の対称差の大きさの最小。答えが別の類なら `null`。
 */
export function measureMagicSquareNearDistance(
  a: { givens: MagicSquareGrid; solution: MagicSquareGrid },
  b: { givens: MagicSquareGrid; solution: MagicSquareGrid },
): number | null {
  const size = Math.round(Math.sqrt(a.solution.length));
  let best: number | null = null;
  for (const map of listMagicSquareSymmetries(size, "G")) {
    for (const complement of [false, true]) {
      const moved = transformMagicSquareGrid(a.solution, map, complement);
      if (compareGrids(moved, b.solution) !== 0) {
        continue;
      }
      const aCells = new Set(
        a.givens.flatMap((value, cellIndex) =>
          value === 0 ? [] : [map[cellIndex]!],
        ),
      );
      const bCells = b.givens.flatMap((value, cellIndex) =>
        value === 0 ? [] : [cellIndex],
      );
      const shared = bCells.filter((cellIndex) => aCells.has(cellIndex)).length;
      const distance = aCells.size + bCells.length - 2 * shared;
      if (best === null || distance < best) {
        best = distance;
      }
    }
  }
  return best;
}

export function isSameMagicSquareKey(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return left.length === right.length && compareGrids(left, right) === 0;
}
