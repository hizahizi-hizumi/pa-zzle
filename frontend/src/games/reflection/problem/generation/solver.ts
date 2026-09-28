import {
  fromReflectionCellCode,
  type ReflectionCellCode,
  reflectionCellCodes,
  reflectionCellsByCode,
  toReflectionCellCode,
} from "@/games/reflection/problem/generation/cell-code";
import type {
  ReflectionBoard,
  ReflectionInventory,
} from "@/games/reflection/puzzle/board";
import {
  areSameReflectionClues,
  computeReflectionClues,
  getReflectionEntryState,
  getReflectionExitEntry,
  getReflectionLeavingDirection,
  isSameReflectionEntry,
  listReflectionEntries,
  type ReflectionClue,
  type ReflectionDirection,
  type ReflectionEntry,
  type ReflectionOutcome,
  stepReflectionPosition,
} from "@/games/reflection/puzzle/laser";

/**
 * 手持ちと外周ヒントに合う配置の数。`2` は「2つ以上」を表す。
 * 一意性の確認には 0 / 1 / 2以上 の区別で足りるので、2つ目を見つけた時点で探索を打ち切る。
 */
export type ReflectionSolutionCount = 0 | 1 | 2;

/**
 * - `status`: `search-limit-reached` なら探索量の上限で打ち切ったため、`solutionCount` は下限にすぎない。
 * - `firstSolution`: 最初に見つけた配置。解が無ければ `null`。
 */
export type ReflectionSolutionSearchResult = {
  status: "complete" | "search-limit-reached";
  solutionCount: ReflectionSolutionCount;
  firstSolution: ReflectionBoard | null;
};

export type ReflectionSolutionSearchInput = {
  size: number;
  inventory: ReflectionInventory;
  clues: readonly ReflectionClue[];
};

/**
 * - `solutionLimit`: この数の解が見つかったら打ち切る。
 * - `searchStepLimit`: 探索の節点数の上限。時間ではなく節点数で打ち切るのは、同じ入力に同じ結果を返し、
 *   生成器が identity から同じ問題を再現できるようにするため。
 */
export type ReflectionSolutionSearchOptions = {
  solutionLimit?: 1 | 2;
  searchStepLimit?: number;
};

/** マスごとに、まだ置ける可能性のあるマスの番号の集合。番号 `code` を `1 << code` のビットで表す。 */
type Domains = Uint8Array;

type SearchClue = {
  entry: ReflectionEntry;
  outcome: ReflectionOutcome;
  distance: number;
};

const absorbSlot = 4;
type TransitionSlot = ReflectionDirection | typeof absorbSlot;
const leavingSlots = [0, 1, 2, 3] as const satisfies readonly TransitionSlot[];
const absorbingSlots = [
  absorbSlot,
] as const satisfies readonly TransitionSlot[];

/** 進む向きと出る向き（または吸収）ごとの、その遷移を起こすマスの番号の集合。 */
const transitionMasks: readonly (readonly number[])[] = leavingSlots.map(
  function listMasksForEntering(entering) {
    return [...leavingSlots, absorbSlot].map(function maskForSlot(slot) {
      const leaving = slot === absorbSlot ? null : slot;
      return reflectionCellCodes.reduce<number>(
        (mask, code) =>
          getReflectionLeavingDirection(
            reflectionCellsByCode[code],
            entering,
          ) === leaving
            ? mask | (1 << code)
            : mask,
        0,
      );
    });
  },
);

/** 外周ヒントを短い順に、同じ長さなら反射・吸収・退出の順に確かめると、候補を早く絞れる。 */
const outcomeSearchRank = {
  reflect: 0,
  absorb: 1,
  exit: 2,
} as const satisfies Record<ReflectionOutcome, number>;

/** 手持ちの残りを割り当てている途中の状態。`remaining` と `assignment` は割り当てのたびに書き換えて戻す。 */
type AssignmentState = {
  domains: Domains;
  remaining: number[];
  assignment: ReflectionCellCode[];
};

class SearchLimitReached extends Error {}

function isSingleton(domain: number): boolean {
  return (domain & (domain - 1)) === 0;
}

function toDomainsKey(domains: Domains): string {
  return String.fromCharCode(...domains);
}

function listDomainCodes(domain: number): ReflectionCellCode[] {
  return reflectionCellCodes.filter((code) => (domain & (1 << code)) !== 0);
}

function singletonCode(domain: number): ReflectionCellCode {
  return (31 - Math.clz32(domain)) as ReflectionCellCode;
}

function toCodeCounts(size: number, inventory: ReflectionInventory): number[] {
  return reflectionCellCodes.map(function countCode(code) {
    const cell = reflectionCellsByCode[code];
    if (cell !== null) {
      return inventory[cell];
    }
    return (
      size * size -
      reflectionCellsByCode.reduce(
        (total, piece) => (piece === null ? total : total + inventory[piece]),
        0,
      )
    );
  });
}

function sortSearchClues(
  size: number,
  clues: readonly ReflectionClue[],
): SearchClue[] {
  return listReflectionEntries(size)
    .map(function toSearchClue(entry, index) {
      const clue = clues[index];
      if (clue === undefined) {
        throw new RangeError("Reflection clues must cover every entry");
      }
      return { entry, ...clue };
    })
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        outcomeSearchRank[left.outcome] - outcomeSearchRank[right.outcome],
    );
}

/**
 * 外周ヒントを1本ずつ取り上げ、そのヒントを満たす光路ごとに各マスの候補を絞る分岐探索。
 * 全ヒントを通した後、候補が複数残るマスを手持ちの個数に合わせて割り当て、実際に光を通して確かめる。
 */
class ReflectionSolutionSearch {
  private readonly size: number;
  private readonly clues: readonly ReflectionClue[];
  private readonly searchClues: readonly SearchClue[];
  private readonly counts: readonly number[];
  private readonly solutionLimit: number;
  private readonly searchStepLimit: number;
  private searchStepCount = 0;
  readonly solutionKeys = new Set<string>();
  readonly solutions: ReflectionBoard[] = [];

  constructor(
    { size, inventory, clues }: ReflectionSolutionSearchInput,
    {
      solutionLimit = 2,
      searchStepLimit = Infinity,
    }: ReflectionSolutionSearchOptions,
  ) {
    if (clues.length !== size * 4) {
      throw new RangeError("Reflection clues must cover every entry");
    }
    this.size = size;
    this.clues = clues;
    this.searchClues = sortSearchClues(size, clues);
    this.counts = toCodeCounts(size, inventory);
    if (this.counts.some((count) => count < 0)) {
      throw new RangeError("Reflection inventory must fit on the board");
    }
    this.solutionLimit = solutionLimit;
    this.searchStepLimit = searchStepLimit;
  }

  run(): void {
    const allowed = reflectionCellCodes.reduce<number>(
      (mask, code) =>
        (this.counts[code] ?? 0) > 0 ? mask | (1 << code) : mask,
      0,
    );
    this.search(0, new Uint8Array(this.size * this.size).fill(allowed));
  }

  private hasEnoughSolutions(): boolean {
    return this.solutions.length >= this.solutionLimit;
  }

  private countStep(): void {
    this.searchStepCount += 1;
    if (this.searchStepCount > this.searchStepLimit) {
      throw new SearchLimitReached();
    }
  }

  private search(clueIndex: number, domains: Domains): void {
    if (this.hasEnoughSolutions()) {
      return;
    }
    this.countStep();
    const clue = this.searchClues[clueIndex];
    if (clue === undefined) {
      this.completeAssignments(domains);
      return;
    }

    const seenDomainKeys = new Set<string>();
    for (const nextDomains of this.listCluePathDomains(domains, clue)) {
      const key = toDomainsKey(nextDomains);
      if (seenDomainKeys.has(key)) {
        continue;
      }
      seenDomainKeys.add(key);
      if (this.isInventoryFeasible(nextDomains)) {
        this.search(clueIndex + 1, nextDomains);
      }
      if (this.hasEnoughSolutions()) {
        return;
      }
    }
  }

  /** ヒント1本を満たす光路ごとに、光路上のマスをその遷移を起こすピースへ絞った候補を返す。 */
  private listCluePathDomains(domains: Domains, clue: SearchClue): Domains[] {
    const { size } = this;
    const working = domains.slice();
    const results: Domains[] = [];

    function visit(
      row: number,
      column: number,
      entering: ReflectionDirection,
      distance: number,
    ): void {
      const cellIndex = row * size + column;
      const currentDomain = working[cellIndex] ?? 0;
      const reachesTarget = distance === clue.distance;
      const slots =
        clue.outcome === "absorb" && reachesTarget
          ? absorbingSlots
          : leavingSlots;

      for (const slot of slots) {
        const allowed =
          currentDomain & (transitionMasks[entering]?.[slot] ?? 0);
        if (allowed === 0) {
          continue;
        }
        working[cellIndex] = allowed;
        if (slot === absorbSlot) {
          results.push(working.slice());
        } else {
          const next = stepReflectionPosition(row, column, slot);
          const exit = getReflectionExitEntry(size, next.row, next.column);
          if (exit !== null) {
            const outcome = isSameReflectionEntry(exit, clue.entry)
              ? "reflect"
              : "exit";
            if (reachesTarget && outcome === clue.outcome) {
              results.push(working.slice());
            }
          } else if (distance < clue.distance) {
            visit(next.row, next.column, slot, distance + 1);
          }
        }
        working[cellIndex] = currentDomain;
      }
    }

    const start = getReflectionEntryState(size, clue.entry);
    visit(start.row, start.column, start.direction, 1);
    return results;
  }

  private isInventoryFeasible(domains: Domains): boolean {
    const fixedCounts = reflectionCellCodes.map(() => 0);
    const possibleCounts = reflectionCellCodes.map(() => 0);
    for (const domain of domains) {
      for (const code of listDomainCodes(domain)) {
        possibleCounts[code] = (possibleCounts[code] ?? 0) + 1;
      }
      if (isSingleton(domain)) {
        const code = singletonCode(domain);
        fixedCounts[code] = (fixedCounts[code] ?? 0) + 1;
      }
    }
    return reflectionCellCodes.every(
      (code) =>
        (fixedCounts[code] ?? 0) <= (this.counts[code] ?? 0) &&
        (this.counts[code] ?? 0) <= (possibleCounts[code] ?? 0),
    );
  }

  /** 候補が1つに決まったマスはそのまま置き、残りのマスへ手持ちの残りを割り当てる。 */
  private completeAssignments(domains: Domains): void {
    const remaining = [...this.counts];
    const assignment = new Array<ReflectionCellCode>(domains.length).fill(0);
    const variableCells: number[] = [];

    for (const [cellIndex, domain] of domains.entries()) {
      if (!isSingleton(domain)) {
        variableCells.push(cellIndex);
        continue;
      }
      const code = singletonCode(domain);
      assignment[cellIndex] = code;
      remaining[code] = (remaining[code] ?? 0) - 1;
      if ((remaining[code] ?? 0) < 0) {
        return;
      }
    }

    this.assignRemaining({ domains, remaining, assignment }, variableCells);
  }

  private assignRemaining(
    state: AssignmentState,
    cells: readonly number[],
  ): void {
    if (this.hasEnoughSolutions()) {
      return;
    }
    this.countStep();
    const { domains, remaining, assignment } = state;
    if (cells.length === 0) {
      if (remaining.every((count) => count === 0)) {
        this.acceptAssignment(assignment);
      }
      return;
    }

    const bestOffset = findMostConstrainedOffset(cells, domains, remaining);
    const cellIndex = cells[bestOffset]!;
    const rest = cells.filter((_, offset) => offset !== bestOffset);

    for (const code of listDomainCodes(domains[cellIndex] ?? 0)) {
      if ((remaining[code] ?? 0) <= 0) {
        continue;
      }
      assignment[cellIndex] = code;
      remaining[code] = (remaining[code] ?? 0) - 1;
      if (canFillRemaining(rest, domains, remaining)) {
        this.assignRemaining(state, rest);
      }
      remaining[code] = (remaining[code] ?? 0) + 1;
      assignment[cellIndex] = 0;
      if (this.hasEnoughSolutions()) {
        return;
      }
    }
  }

  private acceptAssignment(assignment: readonly ReflectionCellCode[]): void {
    const board = {
      size: this.size,
      cells: assignment.map(fromReflectionCellCode),
    };
    if (!areSameReflectionClues(computeReflectionClues(board), this.clues)) {
      return;
    }
    const key = board.cells.map(toReflectionCellCode).join("");
    if (this.solutionKeys.has(key)) {
      return;
    }
    this.solutionKeys.add(key);
    this.solutions.push(board);
  }

  isSearchLimitReached(): boolean {
    return this.searchStepCount > this.searchStepLimit;
  }
}

function countAvailableCodes(
  domain: number,
  remaining: readonly number[],
): number {
  return listDomainCodes(domain).filter((code) => (remaining[code] ?? 0) > 0)
    .length;
}

function findMostConstrainedOffset(
  cells: readonly number[],
  domains: Domains,
  remaining: readonly number[],
): number {
  let bestOffset = 0;
  let bestCount = Infinity;
  for (const [offset, cellIndex] of cells.entries()) {
    const count = countAvailableCodes(domains[cellIndex] ?? 0, remaining);
    if (count < bestCount) {
      bestOffset = offset;
      bestCount = count;
    }
  }
  return bestOffset;
}

function canFillRemaining(
  cells: readonly number[],
  domains: Domains,
  remaining: readonly number[],
): boolean {
  return reflectionCellCodes.every(function hasRoom(code) {
    const count = remaining[code] ?? 0;
    if (count < 0) {
      return false;
    }
    if (count === 0) {
      return true;
    }
    const room = cells.filter(
      (cellIndex) => ((domains[cellIndex] ?? 0) & (1 << code)) !== 0,
    ).length;
    return room >= count;
  });
}

/** 手持ちのピースをすべて使い、全外周ヒントを満たす配置を数える。 */
export function countReflectionSolutions(
  input: ReflectionSolutionSearchInput,
  options: ReflectionSolutionSearchOptions = {},
): ReflectionSolutionSearchResult {
  const search = new ReflectionSolutionSearch(input, options);
  try {
    search.run();
  } catch (error) {
    if (!(error instanceof SearchLimitReached)) {
      throw error;
    }
  }
  return {
    status: search.isSearchLimitReached() ? "search-limit-reached" : "complete",
    solutionCount: Math.min(
      search.solutions.length,
      2,
    ) as ReflectionSolutionCount,
    firstSolution: search.solutions[0] ?? null,
  };
}
