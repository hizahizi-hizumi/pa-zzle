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
 * - `searchStepLimit`: 探索量の上限。探索の節点と、ヒント1本の光路をたどった1マスをそれぞれ1と数える。
 *   時間ではなく探索量で打ち切るのは、同じ入力に同じ結果を返し、生成器が identity から同じ問題を再現できるようにするため。
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

const domainValueCount = 1 << reflectionCellCodes.length;

/** 候補の集合（ビット）ごとの、含まれる番号を昇順に並べたもの。探索の内側で配列を作らないよう先に求めておく。 */
const codesByDomain: readonly (readonly ReflectionCellCode[])[] = Array.from(
  { length: domainValueCount },
  (_, domain) =>
    reflectionCellCodes.filter((code) => (domain & (1 << code)) !== 0),
);

function isSingleton(domain: number): boolean {
  return (domain & (domain - 1)) === 0;
}

function listDomainCodes(domain: number): readonly ReflectionCellCode[] {
  return codesByDomain[domain] ?? [];
}

function singletonCode(domain: number): ReflectionCellCode {
  return (31 - Math.clz32(domain)) as ReflectionCellCode;
}

/**
 * 番号ごとの、候補が1つに決まったマスの数（`fixed`）と、置く可能性のあるマスの数（`possible`）。
 * 手持ちの個数と比べて、光路で絞った候補がまだ手持ちを置き切れるかを確かめる。
 */
type CodeCounts = { fixed: Int32Array; possible: Int32Array };

function addDomainToCounts(counts: CodeCounts, domain: number, sign: 1 | -1) {
  for (const code of listDomainCodes(domain)) {
    counts.possible[code]! += sign;
  }
  if (domain !== 0 && isSingleton(domain)) {
    counts.fixed[singletonCode(domain)]! += sign;
  }
}

function countDomainCodes(domains: Domains): CodeCounts {
  const counts = {
    fixed: new Int32Array(reflectionCellCodes.length),
    possible: new Int32Array(reflectionCellCodes.length),
  };
  for (const domain of domains) {
    addDomainToCounts(counts, domain, 1);
  }
  return counts;
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

    for (const nextDomains of this.listCluePathDomains(domains, clue)) {
      this.search(clueIndex + 1, nextDomains);
      if (this.hasEnoughSolutions()) {
        return;
      }
    }
  }

  /**
   * ヒント1本を満たす光路ごとに、光路上のマスをその遷移を起こすピースへ絞った候補を返す。
   * 光路が違っても絞った結果が同じ候補は1つにまとめ、手持ちを置き切れない候補は除く。並びは光路を見つけた順。
   * 絞った結果は元の候補と光路上のマスでだけ違うので、同じかどうかも手持ちの判定も、変わったマスだけで行う。
   */
  private listCluePathDomains(domains: Domains, clue: SearchClue): Domains[] {
    const search = this;
    const { size, counts } = this;
    const mustLeaveBoard = clue.outcome !== "absorb";
    const working = domains.slice();
    const parentCounts = countDomainCodes(domains);
    const childCounts: CodeCounts = {
      fixed: new Int32Array(parentCounts.fixed.length),
      possible: new Int32Array(parentCounts.possible.length),
    };
    const results: Domains[] = [];
    const seenKeys = new Set<string>();
    const touchedCells: number[] = [];
    const isChanged = new Uint8Array(domains.length);
    const changedCells: number[] = [];

    function collectChangedCells(): void {
      changedCells.length = 0;
      for (const cellIndex of touchedCells) {
        if (
          isChanged[cellIndex] === 0 &&
          working[cellIndex] !== domains[cellIndex]
        ) {
          isChanged[cellIndex] = 1;
          changedCells.push(cellIndex);
        }
      }
      for (const cellIndex of changedCells) {
        isChanged[cellIndex] = 0;
      }
      changedCells.sort((left, right) => left - right);
    }

    function toChangeKey(): string {
      let key = "";
      for (const cellIndex of changedCells) {
        key += String.fromCharCode(cellIndex, working[cellIndex] ?? 0);
      }
      return key;
    }

    function fitsInventory(): boolean {
      childCounts.fixed.set(parentCounts.fixed);
      childCounts.possible.set(parentCounts.possible);
      for (const cellIndex of changedCells) {
        addDomainToCounts(childCounts, domains[cellIndex] ?? 0, -1);
        addDomainToCounts(childCounts, working[cellIndex] ?? 0, 1);
      }
      return counts.every(
        (count, code) =>
          (childCounts.fixed[code] ?? 0) <= count &&
          count <= (childCounts.possible[code] ?? 0),
      );
    }

    function recordResult(): void {
      collectChangedCells();
      const key = toChangeKey();
      if (seenKeys.has(key)) {
        return;
      }
      seenKeys.add(key);
      if (fitsInventory()) {
        results.push(working.slice());
      }
    }

    function visit(
      row: number,
      column: number,
      entering: ReflectionDirection,
      distance: number,
    ): void {
      search.countStep();
      const cellIndex = row * size + column;
      const currentDomain = working[cellIndex] ?? 0;
      const reachesTarget = distance === clue.distance;
      const slots =
        clue.outcome === "absorb" && reachesTarget
          ? absorbingSlots
          : leavingSlots;

      touchedCells.push(cellIndex);
      for (const slot of slots) {
        const allowed =
          currentDomain & (transitionMasks[entering]?.[slot] ?? 0);
        if (allowed === 0) {
          continue;
        }
        working[cellIndex] = allowed;
        if (slot === absorbSlot) {
          recordResult();
        } else {
          const next = stepReflectionPosition(row, column, slot);
          const exit = getReflectionExitEntry(size, next.row, next.column);
          if (exit !== null) {
            const outcome = isSameReflectionEntry(exit, clue.entry)
              ? "reflect"
              : "exit";
            if (reachesTarget && outcome === clue.outcome) {
              recordResult();
            }
          } else if (
            distance < clue.distance &&
            (!mustLeaveBoard ||
              distance +
                countMinimumCellsToLeave(size, next.row, next.column) <=
                clue.distance)
          ) {
            visit(next.row, next.column, slot, distance + 1);
          }
        }
        working[cellIndex] = currentDomain;
      }
      touchedCells.pop();
    }

    const start = getReflectionEntryState(size, clue.entry);
    visit(start.row, start.column, start.direction, 1);
    return results;
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

/** そのマスから盤面の外へ出るまでに、少なくとも通るマスの数（そのマスを含む）。 */
function countMinimumCellsToLeave(
  size: number,
  row: number,
  column: number,
): number {
  return Math.min(row, column, size - 1 - row, size - 1 - column) + 1;
}

function countAvailableCodes(
  domain: number,
  remaining: readonly number[],
): number {
  let count = 0;
  for (const code of listDomainCodes(domain)) {
    if ((remaining[code] ?? 0) > 0) {
      count += 1;
    }
  }
  return count;
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
  const room = new Array<number>(reflectionCellCodes.length).fill(0);
  for (const cellIndex of cells) {
    for (const code of listDomainCodes(domains[cellIndex] ?? 0)) {
      room[code]! += 1;
    }
  }
  return reflectionCellCodes.every(function hasRoom(code) {
    const count = remaining[code] ?? 0;
    return count >= 0 && (count === 0 || (room[code] ?? 0) >= count);
  });
}

/**
 * 一意性の確認に使う探索量の上限。生成器と難易度分析で同じ値を使い、上限に達した候補は一意とみなさない。
 * 11×11・20ピースでも、上限に達する候補は生成器が作り直せる程度に少ない。
 */
export const REFLECTION_UNIQUENESS_SEARCH_STEP_LIMIT = 4_000_000;

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
