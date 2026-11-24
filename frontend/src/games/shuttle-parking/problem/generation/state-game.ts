import {
  listShuttleParkingCarCells,
  listShuttleParkingCarExitSides,
  listShuttleParkingPathCells,
} from "@/games/shuttle-parking/puzzle/lot";
import type { ShuttleParkingPuzzle } from "@/games/shuttle-parking/puzzle/rules";

/**
 * 難易度の分析で全部の状態をたどるための、速い盤面。ルールは `puzzle/rules.ts` と同じ。
 * 状態は（駐車場に残る車の集合, 色ごとの待機枠の車の定員を入った順に並べたもの）。同じ色・同じ定員の待機車は入れ替えても
 * 同じ状態なので、車の番号を持たない。乗った人数と座席の埋まり方は、残りの車の集合から決まる。
 */
export type AnalysisState = {
  readonly mask: number;
  readonly rows: readonly (readonly number[])[];
};

export function createAnalysisStateKey(state: AnalysisState): string {
  return `${state.mask}:${state.rows.map((row) => row.join(",")).join("/")}`;
}

export function* iterateBits(mask: number): Generator<number> {
  let rest = mask;
  while (rest) {
    const low = rest & -rest;
    yield 31 - Math.clz32(low);
    rest ^= low;
  }
}

export function countBits(mask: number): number {
  let count = 0;
  for (let rest = mask; rest; rest &= rest - 1) count += 1;
  return count;
}

/** 車ごとに、開いた辺へ向かう進路を塞ぐ車の集合（進路ごと。小さい行・列の側から）。 */
function createSides(puzzle: ShuttleParkingPuzzle): number[][] {
  const { lot } = puzzle;
  const owners = new Map<string, number>();
  lot.cars.forEach((car, carId) => {
    for (const { row, column } of listShuttleParkingCarCells(car)) {
      owners.set(`${row}:${column}`, carId);
    }
  });
  return lot.cars.map((car, carId) =>
    listShuttleParkingCarExitSides(lot, car).map((side) =>
      listShuttleParkingPathCells(lot, car, side).reduce(
        (ray, { row, column }) => {
          const owner = owners.get(`${row}:${column}`);
          return owner === undefined || owner === carId
            ? ray
            : ray | (1 << owner);
        },
        0,
      ),
    ),
  );
}

export class AnalysisGame {
  readonly puzzle: ShuttleParkingPuzzle;
  readonly bays: number;
  readonly sides: readonly (readonly number[])[];
  readonly carCount: number;
  readonly full: number;
  /** 色を記号順に並べた番号。 */
  readonly colorOf: readonly number[];
  readonly lengths: readonly number[];
  readonly queueColors: readonly number[];
  readonly colorMasks: readonly number[];
  readonly paletteSize: number;
  readonly start: AnalysisState;
  readonly #info = new Map<number, readonly [number, readonly number[]]>();
  readonly #legal = new Map<number, readonly number[]>();
  readonly #wins = new Map<string, boolean>();
  readonly #reach = new Map<string, number>();
  readonly #steps = new Map<string, AnalysisState>();

  constructor(puzzle: ShuttleParkingPuzzle, bays: number = puzzle.bayCount) {
    this.puzzle = puzzle;
    this.bays = bays;
    this.sides = createSides(puzzle);
    this.carCount = puzzle.lot.cars.length;
    this.full = (1 << this.carCount) - 1;
    const palette = [
      ...new Set(puzzle.lot.cars.map(({ color }) => color)),
    ].sort();
    this.paletteSize = palette.length;
    this.colorOf = puzzle.lot.cars.map(({ color }) => palette.indexOf(color));
    this.lengths = puzzle.lot.cars.map(({ capacity }) => capacity);
    this.queueColors = puzzle.passengers.map((color) => palette.indexOf(color));
    this.colorMasks = palette.map((_, color) =>
      this.colorOf.reduce(
        (mask, carColor, carId) =>
          carColor === color ? mask | (1 << carId) : mask,
        0,
      ),
    );
    this.start = { mask: this.full, rows: palette.map(() => []) };
  }

  /** 残りの車の集合から、乗った人数（列の先頭の位置）と、色ごとの外に出た車の空き座席。 */
  info(mask: number): readonly [number, readonly number[]] {
    const cached = this.#info.get(mask);
    if (cached) return cached;
    const supply = new Array<number>(this.paletteSize).fill(0);
    for (const carId of iterateBits(this.full & ~mask)) {
      supply[this.colorOf[carId]!]! += this.lengths[carId]!;
    }
    let head = 0;
    for (const color of this.queueColors) {
      if (!supply[color]) break;
      supply[color] -= 1;
      head += 1;
    }
    const result = [head, supply] as const;
    this.#info.set(mask, result);
    return result;
  }

  progress(state: AnalysisState): number {
    return this.info(state.mask)[0];
  }

  waiting(state: AnalysisState): number {
    return state.rows.reduce((sum, row) => sum + row.length, 0);
  }

  step(state: AnalysisState, carId: number): AnalysisState {
    const key = `${createAnalysisStateKey(state)}>${carId}`;
    const cached = this.#steps.get(key);
    if (cached) return cached;
    const mask = state.mask & ~(1 << carId);
    const free = this.info(mask)[1];
    const rows = state.rows.map((current, color) => {
      const row =
        color === this.colorOf[carId]
          ? [...current, this.lengths[carId]!]
          : current;
      let consumed =
        row.reduce((sum, length) => sum + length, 0) - free[color]!;
      let index = 0;
      while (index < row.length && consumed >= row[index]!) {
        consumed -= row[index]!;
        index += 1;
      }
      return row.slice(index);
    });
    const child = { mask, rows };
    this.#steps.set(key, child);
    return child;
  }

  /** 待機枠を見ずに、進路が空いている車。 */
  geometricMoves(mask: number): readonly number[] {
    const cached = this.#legal.get(mask);
    if (cached) return cached;
    const moves = [...iterateBits(mask)].filter((carId) =>
      this.sides[carId]!.some((ray) => !(ray & mask)),
    );
    this.#legal.set(mask, moves);
    return moves;
  }

  moves(state: AnalysisState): readonly number[] {
    if (state.mask === 0 || this.waiting(state) >= this.bays) return [];
    return this.geometricMoves(state.mask);
  }

  wins(state: AnalysisState): boolean {
    if (state.mask === 0) return true;
    const key = createAnalysisStateKey(state);
    const cached = this.#wins.get(key);
    if (cached !== undefined) return cached;
    const result = this.moves(state).some((carId) =>
      this.wins(this.step(state, carId)),
    );
    this.#wins.set(key, result);
    return result;
  }

  /** この状態から、どう出しても届く、乗せられる人数の最大。 */
  maxReach(state: AnalysisState): number {
    const key = createAnalysisStateKey(state);
    const cached = this.#reach.get(key);
    if (cached !== undefined) return cached;
    const result = Math.max(
      this.progress(state),
      ...this.moves(state).map((carId) =>
        this.maxReach(this.step(state, carId)),
      ),
    );
    this.#reach.set(key, result);
    return result;
  }

  /** 全員を送り出す出し方（出す車の順）の数。 */
  countSolutions(): number {
    const cache = new Map<string, number>();
    const count = (state: AnalysisState): number => {
      if (state.mask === 0) return 1;
      const key = createAnalysisStateKey(state);
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const total = this.moves(state).reduce(
        (sum, carId) => sum + count(this.step(state, carId)),
        0,
      );
      cache.set(key, total);
      return total;
    };
    return count(this.start);
  }

  /** 1台ずつ一様に無作為に出していく人が勝つ確率。 */
  uniformWinProbability(): number {
    const cache = new Map<string, number>();
    const value = (state: AnalysisState): number => {
      if (state.mask === 0) return 1;
      const key = createAnalysisStateKey(state);
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const moves = this.moves(state);
      const result = moves.length
        ? moves.reduce(
            (sum, carId) => sum + value(this.step(state, carId)),
            0,
          ) / moves.length
        : 0;
      cache.set(key, result);
      return result;
    };
    return value(this.start);
  }
}

/**
 * 解ける最小の待機枠の数。待機枠の数を見ずに出していき、どこかの順で待つ車の数の最大を最も小さくする。全部出せないなら `null`。
 */
export function findShuttleParkingMinimumBays(
  puzzle: ShuttleParkingPuzzle,
): number | null {
  const stuck = puzzle.lot.cars.length + 1;
  const probe = new AnalysisGame(puzzle, stuck);
  const cache = new Map<string, number>();
  const peak = (state: AnalysisState): number => {
    if (state.mask === 0) return 0;
    const key = createAnalysisStateKey(state);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let best = stuck;
    for (const carId of probe.geometricMoves(state.mask)) {
      const child = probe.step(state, carId);
      best = Math.min(
        best,
        Math.max(child.mask ? probe.waiting(child) : 0, peak(child)),
      );
    }
    cache.set(key, best);
    return best;
  };
  const value = peak(probe.start);
  return value >= stuck ? null : value + 1;
}
