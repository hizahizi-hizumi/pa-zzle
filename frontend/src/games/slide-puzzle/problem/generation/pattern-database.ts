import {
  getSlidePuzzleNeighborCells,
  type SlidePuzzleHeuristic,
} from "@/games/slide-puzzle/problem/generation/solver";
import type { SlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";

const UNVISITED = 0xff;
/**
 * 構築中は、集合内タイルと空白の位置を状態とする（マス数）^(枚数 + 1) バイトの表を一時確保する。
 * 5 枚で 4×4 は 16 MB、5×5 は 244 MB。6 枚では 4×4 でも 256 MB、5×5 は 6 GB になるので、5 枚までに限る。
 */
const MAXIMUM_PATTERN_SIZE = 5;

/**
 * 互いに素なタイル集合ごとの加算的パターンデータベース（Korf & Felner 2002）。
 * 各集合について、集合内のタイルの移動だけを数えた最短手数を全配置で求めておく。
 * 集合が互いに素なので、値の和も許容的な下界になる。
 */
type SlidePuzzlePatternDatabase = {
  boardSize: SlidePuzzleBoardSize;
  patterns: readonly (readonly number[])[];
  /** 集合内タイルのマス index を（マス数）進の桁として並べた位置で引く最短手数。 */
  distances: readonly Uint8Array[];
};

/**
 * 盤面サイズごとの既定の分割。
 * - 3×3: 4 枚ずつ 2 集合。構築は一瞬で終わる。
 * - 4×4: 5 枚ずつ 3 集合。1 集合あたり数秒で作れ、表は 1 集合 1 MB（16^5 バイト）。
 * - 5×5: 5 枚 4 集合と 4 枚 1 集合。1 集合に数十秒〜数分かかり、表は合計約 39 MB になるので、
 *   問題集の事前生成だけで使う。
 */
const defaultPatternsByBoardSize: Record<
  SlidePuzzleBoardSize,
  readonly (readonly number[])[]
> = {
  3: [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
  ],
  4: [
    [1, 2, 3, 5, 6],
    [4, 7, 8, 11, 12],
    [9, 10, 13, 14, 15],
  ],
  5: [
    [1, 2, 3, 6, 7],
    [4, 5, 8, 9, 10],
    [11, 12, 16, 17, 21],
    [13, 14, 15, 19, 20],
    [18, 22, 23, 24],
  ],
};

/**
 * 集合内タイルの位置と空白の位置を状態として、0-1 幅優先探索で完成盤面から逆にたどる。
 * 空白が集合外のタイルと入れ替わる手は 0 手、集合内のタイルと入れ替わる手は 1 手と数える。
 */
function buildPatternDistances(
  pattern: readonly number[],
  boardSize: SlidePuzzleBoardSize,
): Uint8Array {
  const cellCount = boardSize * boardSize;
  const neighborCells = getSlidePuzzleNeighborCells(boardSize);
  const tileCount = pattern.length;
  const blankDigit = tileCount;
  const stateCount = cellCount ** (tileCount + 1);
  const stateDistances = new Uint8Array(stateCount).fill(UNVISITED);
  const patternDistances = new Uint8Array(cellCount ** tileCount).fill(
    UNVISITED,
  );
  const digitWeights = Array.from(
    { length: tileCount + 1 },
    (_, digit) => cellCount ** digit,
  );
  function readDigit(key: number, digit: number): number {
    return Math.floor(key / (digitWeights[digit] ?? 1)) % cellCount;
  }

  const goalKey =
    pattern.reduce(
      (key, tile, digit) => key + (tile - 1) * (digitWeights[digit] ?? 0),
      0,
    ) +
    (cellCount - 1) * (digitWeights[blankDigit] ?? 0);

  let current = new Int32Array(1024);
  let currentLength = 0;
  let next = new Int32Array(1024);
  let nextLength = 0;
  function pushTo(queue: "current" | "next", key: number) {
    if (queue === "current") {
      if (currentLength === current.length) {
        const grown = new Int32Array(current.length * 2);
        grown.set(current);
        current = grown;
      }
      current[currentLength] = key;
      currentLength += 1;
    } else {
      if (nextLength === next.length) {
        const grown = new Int32Array(next.length * 2);
        grown.set(next);
        next = grown;
      }
      next[nextLength] = key;
      nextLength += 1;
    }
  }

  stateDistances[goalKey] = 0;
  pushTo("current", goalKey);
  const tileByCell = new Int8Array(cellCount);
  for (let distance = 0; currentLength > 0; distance += 1) {
    for (let index = 0; index < currentLength; index += 1) {
      const key = current[index] ?? 0;
      if (stateDistances[key] !== distance) {
        continue;
      }
      const patternKey = key % (digitWeights[blankDigit] ?? 1);
      if ((patternDistances[patternKey] ?? UNVISITED) > distance) {
        patternDistances[patternKey] = distance;
      }

      tileByCell.fill(-1);
      for (let digit = 0; digit < tileCount; digit += 1) {
        tileByCell[readDigit(key, digit)] = digit;
      }
      const blankCell = readDigit(key, blankDigit);
      for (const cell of neighborCells[blankCell] ?? []) {
        const digit = tileByCell[cell] ?? -1;
        const blankShift = (cell - blankCell) * (digitWeights[blankDigit] ?? 0);
        if (digit < 0) {
          const nextKey = key + blankShift;
          if ((stateDistances[nextKey] ?? 0) > distance) {
            stateDistances[nextKey] = distance;
            pushTo("current", nextKey);
          }
          continue;
        }
        const nextKey =
          key + blankShift + (blankCell - cell) * (digitWeights[digit] ?? 0);
        if ((stateDistances[nextKey] ?? 0) > distance + 1) {
          stateDistances[nextKey] = distance + 1;
          pushTo("next", nextKey);
        }
      }
    }
    [current, next] = [next, current];
    currentLength = nextLength;
    nextLength = 0;
  }

  return patternDistances;
}

export function buildSlidePuzzlePatternDatabase(
  boardSize: SlidePuzzleBoardSize,
  patterns: readonly (readonly number[])[] = defaultPatternsByBoardSize[
    boardSize
  ],
): SlidePuzzlePatternDatabase {
  const cellCount = boardSize * boardSize;
  const tiles = patterns.flat();
  if (
    new Set(tiles).size !== tiles.length ||
    tiles.some(
      (tile) => !Number.isInteger(tile) || tile < 1 || tile >= cellCount,
    )
  ) {
    throw new RangeError(
      `Patterns must be disjoint sets of tiles 1〜${cellCount - 1}`,
    );
  }
  if (patterns.some((pattern) => pattern.length > MAXIMUM_PATTERN_SIZE)) {
    throw new RangeError(
      `Each pattern must have at most ${MAXIMUM_PATTERN_SIZE} tiles`,
    );
  }

  return {
    boardSize,
    patterns,
    distances: patterns.map((pattern) =>
      buildPatternDistances(pattern, boardSize),
    ),
  };
}

export function createSlidePuzzlePatternDatabaseHeuristic(
  database: SlidePuzzlePatternDatabase,
): SlidePuzzleHeuristic {
  const { boardSize } = database;
  const cellCount = boardSize * boardSize;
  const patternOfTile = new Int8Array(cellCount).fill(-1);
  const digitWeightOfTile = new Int32Array(cellCount);
  for (const [patternIndex, pattern] of database.patterns.entries()) {
    for (const [digit, tile] of pattern.entries()) {
      patternOfTile[tile] = patternIndex;
      digitWeightOfTile[tile] = cellCount ** digit;
    }
  }
  const patternKeys = new Int32Array(database.patterns.length);
  const patternValues = new Int32Array(database.patterns.length);
  let total = 0;

  return {
    boardSize,
    reset(cells) {
      patternKeys.fill(0);
      for (let cell = 0; cell < cells.length; cell += 1) {
        const tile = cells[cell] ?? 0;
        const patternIndex = patternOfTile[tile] ?? -1;
        if (patternIndex >= 0) {
          patternKeys[patternIndex] =
            (patternKeys[patternIndex] ?? 0) +
            cell * (digitWeightOfTile[tile] ?? 0);
        }
      }
      total = 0;
      for (const [patternIndex, distances] of database.distances.entries()) {
        const value = distances[patternKeys[patternIndex] ?? 0] ?? 0;
        patternValues[patternIndex] = value;
        total += value;
      }
      return total;
    },
    update(_cells, tile, from, to) {
      const patternIndex = patternOfTile[tile] ?? -1;
      if (patternIndex < 0) {
        return total;
      }
      const key =
        (patternKeys[patternIndex] ?? 0) +
        (to - from) * (digitWeightOfTile[tile] ?? 0);
      patternKeys[patternIndex] = key;
      const value = database.distances[patternIndex]?.[key] ?? 0;
      total += value - (patternValues[patternIndex] ?? 0);
      patternValues[patternIndex] = value;
      return total;
    },
  };
}
