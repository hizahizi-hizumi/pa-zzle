import {
  type ReflectionCellCode,
  reflectionCellCodes,
  reflectionCellsByCode,
} from "@/games/reflection/problem/generation/cell-code";
import type { ReflectionInventory } from "@/games/reflection/puzzle/board";
import {
  getReflectionEntryState,
  getReflectionExitEntry,
  getReflectionLeavingDirection,
  listReflectionEntries,
  type ReflectionClue,
  type ReflectionDirection,
  type ReflectionOutcome,
  stepReflectionPosition,
} from "@/games/reflection/puzzle/laser";

/**
 * 人間の推論の深さ。数字が大きいほど深い。
 * - `1` 単一ヒント: 1本の外周ヒントだけで、必ず通るマスのピース（または空き）が1つに決まる。
 * - `2` 直接整合性: マスとピースの候補を1つ固定し、全外周ヒントへ直接照らすと成り立たない候補を除く。
 * - `3` 制約伝播: 2の除外で候補が減った盤面へ、もう一度2を繰り返して決める。
 * - `4` 在庫: 手持ちの残り数と置ける場所の数を合わせ、光路の制約と行き来して決める。1本の光路に使えるピースも残り数までに限る。
 * - `5` 仮定と矛盾: 候補を1つ仮に置き、2〜4を進めた先で矛盾が出る候補を除く。
 *
 * どのレベルでも、光路は通るマスごとに1つのピース（または空き）を決めた並びとして扱い、同じマスを2回通るなら同じピースとみなす。
 */
export const reflectionReasoningLevels = [1, 2, 3, 4, 5] as const;

export type ReflectionReasoningLevel =
  (typeof reflectionReasoningLevels)[number];

export type ReflectionHumanSolveInput = {
  size: number;
  inventory: ReflectionInventory;
  clues: readonly ReflectionClue[];
};

/**
 * - `solved`: 推論レベル1〜5のどこかで、手持ちの全ピースの置き場所が決まった。`highestLevel` はそこまでに使った最も深いレベル。
 * - `unresolved`: 5まで使っても置き場所が決まらないマスが残った（評価不能）。
 * - `contradiction`: 外周ヒントと手持ちに合う配置が無い。
 *
 * - `fixedPieceCountByLevel`: 各レベルの推論で新しく置き場所が決まったピースの数。添字0がレベル1。
 * - `propagationRoundCount`: 直接整合性・在庫の適用で候補が変わった回数（レベル2の1回を含む）。
 * - `assumptionTestCount` / `assumptionEliminationCount`: レベル5で仮に置いた回数と、矛盾で除いた候補の数。
 * - `unresolvedCellCount`: まだピースが入り得るのに決まらないマスの数。`contradiction` では全マス数。
 */
export type ReflectionHumanSolveTrace = {
  status: "solved" | "unresolved" | "contradiction";
  highestLevel: ReflectionReasoningLevel | null;
  fixedPieceCountByLevel: readonly [number, number, number, number, number];
  propagationRoundCount: number;
  assumptionTestCount: number;
  assumptionEliminationCount: number;
  unresolvedCellCount: number;
};

/**
 * - `observeDomains`: 候補を絞るたびに、各マスの候補（マスの番号 `code` を `1 << code` のビットで表す）を受け取る。
 *   既知の解を候補から落とさないことを確かめるために使う。
 */
export type ReflectionHumanSolveOptions = {
  observeDomains?: (domains: Readonly<Uint8Array>) => void;
};

/** マスごとの、まだ置ける可能性のあるマスの番号の集合（ビット）。 */
type Domains = Uint8Array;

/** 光の状態 `cellIndex * 4 + 進む向き`。 */
type LaserState = number;

const absorbed = -1;

type SolverClue = {
  entryOrder: number;
  startState: LaserState;
  outcome: ReflectionOutcome;
  distance: number;
};

/**
 * - `transitions`: 状態とマスの番号から決まる遷移。吸収なら `absorbed`、盤面の外へ出るなら `-(2 + 出た外周位置の並び順)`、
 *   盤面の中へ進むなら次の状態。
 * - `required`: マスの番号ごとの必要数。空きマスも含む。
 * - `reached` / `viable` / `layers`: ヒント1本の光路を探す前に、届く状態と終われる状態を距離ごとに求める作業領域。
 *   距離と状態の組で引く。
 */
type SolverContext = {
  cellCount: number;
  stateCount: number;
  transitions: Int16Array;
  clues: readonly SolverClue[];
  required: readonly number[];
  reached: Uint8Array;
  viable: Uint8Array;
  layers: Int32Array;
};

type NarrowResult = { feasible: boolean; domains: Domains };

const codeCount = reflectionCellCodes.length;
const emptyBit = 1;

function isSingleton(domain: number): boolean {
  return domain !== 0 && (domain & (domain - 1)) === 0;
}

function singletonCode(domain: number): ReflectionCellCode {
  return (31 - Math.clz32(domain)) as ReflectionCellCode;
}

function toExitTransition(entryOrder: number): number {
  return -(2 + entryOrder);
}

function toExitEntryOrder(transition: number): number {
  return -transition - 2;
}

const transitionTableCache = new Map<number, Int16Array>();

function getTransitionTable(size: number): Int16Array {
  const cached = transitionTableCache.get(size);
  if (cached !== undefined) {
    return cached;
  }
  const entryOrderByKey = new Map(
    listReflectionEntries(size).map((entry, order) => [
      `${entry.side}:${entry.index}`,
      order,
    ]),
  );
  const table = new Int16Array(size * size * 4 * codeCount);
  for (let cellIndex = 0; cellIndex < size * size; cellIndex += 1) {
    const row = Math.floor(cellIndex / size);
    const column = cellIndex % size;
    for (let entering = 0; entering < 4; entering += 1) {
      for (const code of reflectionCellCodes) {
        const leaving = getReflectionLeavingDirection(
          reflectionCellsByCode[code],
          entering as ReflectionDirection,
        );
        let transition = absorbed;
        if (leaving !== null) {
          const next = stepReflectionPosition(row, column, leaving);
          const exit = getReflectionExitEntry(size, next.row, next.column);
          transition =
            exit === null
              ? (next.row * size + next.column) * 4 + leaving
              : toExitTransition(
                  entryOrderByKey.get(`${exit.side}:${exit.index}`)!,
                );
        }
        table[(cellIndex * 4 + entering) * codeCount + code] = transition;
      }
    }
  }
  transitionTableCache.set(size, table);
  return table;
}

function createContext({
  size,
  inventory,
  clues,
}: ReflectionHumanSolveInput): SolverContext {
  const entries = listReflectionEntries(size);
  if (clues.length !== entries.length) {
    throw new RangeError("Reflection clues must cover every entry");
  }
  const cellCount = size * size;
  const stateCount = cellCount * 4;
  const required = reflectionCellCodes.map(function countRequired(code) {
    const cell = reflectionCellsByCode[code];
    return cell === null ? 0 : inventory[cell];
  });
  required[0] = cellCount - required.reduce((total, count) => total + count, 0);
  if (required[0] < 0) {
    throw new RangeError("Reflection inventory must fit on the board");
  }
  const solverClues = entries.map(function toSolverClue(entry, entryOrder) {
    const { outcome, distance } = clues[entryOrder]!;
    const start = getReflectionEntryState(size, entry);
    return {
      entryOrder,
      startState: (start.row * size + start.column) * 4 + start.direction,
      outcome,
      distance,
    };
  });
  const layerCount = Math.max(...solverClues.map((clue) => clue.distance)) + 2;
  return {
    cellCount,
    stateCount,
    transitions: getTransitionTable(size),
    clues: solverClues,
    required,
    reached: new Uint8Array(layerCount * stateCount),
    viable: new Uint8Array(layerCount * stateCount),
    layers: new Int32Array(layerCount * stateCount),
  };
}

/** 遷移 `transition` が `depth` マス目で起きたとき、ヒントどおりに光路が終わるか。 */
function endsAsClue(
  clue: SolverClue,
  transition: number,
  depth: number,
): boolean {
  if (depth !== clue.distance) {
    return false;
  }
  if (transition === absorbed) {
    return clue.outcome === "absorb";
  }
  if (transition >= 0 || clue.outcome === "absorb") {
    return false;
  }
  const outcome: ReflectionOutcome =
    toExitEntryOrder(transition) === clue.entryOrder ? "reflect" : "exit";
  return outcome === clue.outcome;
}

/** ヒントの距離に達する前に盤面の中を進むなら次の状態、そうでなければ `-1`。 */
function continuesInside(
  clue: SolverClue,
  transition: number,
  depth: number,
): LaserState {
  return transition >= 0 && depth < clue.distance ? transition : -1;
}

/** ヒントの入口から前向きに、距離ごとに光が届き得る状態を `layers` の距離 `depth` の区間へ並べ、距離ごとの個数を返す。 */
function listReachedStates(
  context: SolverContext,
  domains: Domains,
  clue: SolverClue,
): number[] {
  const { stateCount, reached, layers, transitions } = context;
  reached.fill(0, 0, (clue.distance + 2) * stateCount);
  layers[stateCount] = clue.startState;
  reached[stateCount + clue.startState] = 1;
  const layerSizes = [0, 1];
  for (let depth = 1; depth <= clue.distance; depth += 1) {
    let nextSize = 0;
    const nextOffset = (depth + 1) * stateCount;
    for (let order = 0; order < layerSizes[depth]!; order += 1) {
      const state = layers[depth * stateCount + order]!;
      const domain = domains[state >> 2]!;
      for (let code = 0; code < codeCount; code += 1) {
        if ((domain & (1 << code)) === 0) {
          continue;
        }
        const next = continuesInside(
          clue,
          transitions[state * codeCount + code]!,
          depth,
        );
        if (next >= 0 && reached[nextOffset + next] === 0) {
          reached[nextOffset + next] = 1;
          layers[nextOffset + nextSize] = next;
          nextSize += 1;
        }
      }
    }
    layerSizes.push(nextSize);
  }
  return layerSizes;
}

/**
 * 後ろ向きに、ヒントどおりに終われる状態へ印を付ける。同じマスを2回通るときに別のピースとして扱う並びも含むので、
 * 光路を探すときの枝刈りにだけ使う（印の無い状態からは、どう置いてもヒントどおりに終われない）。
 */
function markViableStates(
  context: SolverContext,
  domains: Domains,
  clue: SolverClue,
  layerSizes: readonly number[],
): void {
  const { stateCount, viable, layers, transitions } = context;
  viable.fill(0, 0, (clue.distance + 2) * stateCount);
  for (let depth = clue.distance; depth >= 1; depth -= 1) {
    const nextOffset = (depth + 1) * stateCount;
    for (let order = 0; order < layerSizes[depth]!; order += 1) {
      const state = layers[depth * stateCount + order]!;
      const domain = domains[state >> 2]!;
      for (let code = 0; code < codeCount; code += 1) {
        if ((domain & (1 << code)) === 0) {
          continue;
        }
        const transition = transitions[state * codeCount + code]!;
        const next = continuesInside(clue, transition, depth);
        if (
          endsAsClue(clue, transition, depth) ||
          (next >= 0 && viable[nextOffset + next] === 1)
        ) {
          viable[depth * stateCount + state] = 1;
          break;
        }
      }
    }
  }
}

/**
 * 1本のヒントを満たす光路をすべて並べた結果。光路は、通るマスごとに1つのピース（または空き）を決めた並びで、
 * 同じマスを2回通るなら同じピースとして扱う。
 * - `usable`: 光路を並べ切れた。並べ切れないほど多いヒントは、人間もまだ使えないとみなし、候補を絞らない。
 * - `feasible`: ヒントを満たす光路が1つ以上ある。
 * - `usedCodes`: マスごとの、どれかの光路でそのマスに使われる番号。どの光路も通らないマスは0。
 * - `mustCells`: どの光路も必ず通るマス。
 */
type ClueAnalysis =
  | { usable: false }
  | {
      usable: true;
      feasible: boolean;
      usedCodes: Uint8Array;
      mustCells: Uint8Array;
    };

/**
 * ヒント1本の光路を並べるときの探索量の上限。置き場所の決まっていないマスが多いうちは長いヒントの光路が膨大になるため。
 * 上限を10倍にしても、分析スクリプトの問題集合（3,300問）で最高推論レベルが変わるのは8問で、どれも1段浅くなるだけ。
 */
const MAXIMUM_PATH_SEARCH_STEPS_PER_CLUE = 20_000;

/**
 * - `remainingByCode`: 番号ごとの、まだ置き場所の決まっていないマスへ使える残り数。指定すると、1本の光路が
 *   置き場所の決まっていないマスへ使う数をこの残り数までに限る（手持ちの残り数と光路を行き来する推論）。
 */
function analyzeClue(
  context: SolverContext,
  domains: Domains,
  clue: SolverClue,
  remainingByCode: readonly number[] | null,
): ClueAnalysis {
  const { cellCount, stateCount, transitions, viable } = context;
  markViableStates(
    context,
    domains,
    clue,
    listReachedStates(context, domains, clue),
  );
  const usedCodes = new Uint8Array(cellCount);
  const mustCells = new Uint8Array(cellCount);
  if (viable[stateCount + clue.startState] === 0) {
    return { usable: true, feasible: false, usedCodes, mustCells };
  }

  const pathCodes = new Int8Array(cellCount).fill(-1);
  const pathVisitCounts = new Uint8Array(cellCount);
  const pathCells: number[] = [];
  const pathCodeCounts = new Array<number>(codeCount).fill(0);
  let mustCellList: number[] | null = null;
  let searchSteps = 0;

  function recordPath(): void {
    for (const cellIndex of pathCells) {
      usedCodes[cellIndex]! |= 1 << pathCodes[cellIndex]!;
    }
    mustCellList =
      mustCellList === null
        ? [...new Set(pathCells)]
        : mustCellList.filter((cellIndex) => pathVisitCounts[cellIndex]! > 0);
  }

  /** 探索量の上限に達したら `false`。 */
  function extendPath(depth: number, state: LaserState): boolean {
    searchSteps += 1;
    if (searchSteps > MAXIMUM_PATH_SEARCH_STEPS_PER_CLUE) {
      return false;
    }
    const cellIndex = state >> 2;
    const visitedCode = pathCodes[cellIndex]!;
    const isFirstVisit = visitedCode < 0;
    const countsTowardRemaining =
      isFirstVisit &&
      remainingByCode !== null &&
      !isSingleton(domains[cellIndex]!);
    const candidates = isFirstVisit ? domains[cellIndex]! : 1 << visitedCode;
    const nextOffset = (depth + 1) * stateCount;
    for (let code = 0; code < codeCount; code += 1) {
      if ((candidates & (1 << code)) === 0) {
        continue;
      }
      if (
        countsTowardRemaining &&
        pathCodeCounts[code]! >= remainingByCode[code]!
      ) {
        continue;
      }
      const transition = transitions[state * codeCount + code]!;
      const ends = endsAsClue(clue, transition, depth);
      const next = continuesInside(clue, transition, depth);
      if (!ends && (next < 0 || viable[nextOffset + next] === 0)) {
        continue;
      }
      pathCodes[cellIndex] = code;
      pathVisitCounts[cellIndex]! += 1;
      pathCells.push(cellIndex);
      if (countsTowardRemaining) {
        pathCodeCounts[code]! += 1;
      }
      let completed = true;
      if (ends) {
        recordPath();
      } else {
        completed = extendPath(depth + 1, next);
      }
      if (countsTowardRemaining) {
        pathCodeCounts[code]! -= 1;
      }
      pathCells.pop();
      pathVisitCounts[cellIndex]! -= 1;
      if (isFirstVisit) {
        pathCodes[cellIndex] = -1;
      }
      if (!completed) {
        return false;
      }
    }
    return true;
  }

  if (!extendPath(1, clue.startState)) {
    return { usable: false };
  }
  if (mustCellList === null) {
    return { usable: true, feasible: false, usedCodes, mustCells };
  }
  for (const cellIndex of mustCellList as readonly number[]) {
    mustCells[cellIndex] = 1;
  }
  return { usable: true, feasible: true, usedCodes, mustCells };
}

/** マスを番号に固定してもヒントを満たせるか。そのマスを通らない光路か、そのマスでその番号を使う光路があれば満たせる。 */
function isConsistentWithClue(
  analysis: ClueAnalysis,
  cellIndex: number,
  code: number,
): boolean {
  return (
    !analysis.usable ||
    analysis.mustCells[cellIndex] === 0 ||
    (analysis.usedCodes[cellIndex]! & (1 << code)) !== 0
  );
}

/**
 * 直接整合性（レベル2の1回分）。各マスの各候補を固定したとき、全ヒントのどれかが満たせなくなる候補を除く。
 * 全マスを呼び出し時の候補に照らしてから、まとめて更新する。
 * `limitsPathsByRemaining` を指定すると、光路が使えるピースを手持ちの残り数までに限る（レベル4以降）。
 */
function applyCandidateConsistency(
  context: SolverContext,
  domains: Domains,
  limitsPathsByRemaining = false,
): NarrowResult {
  const remainingByCode = limitsPathsByRemaining
    ? countRemainingCodes(context, domains)
    : null;
  const analyses: ClueAnalysis[] = [];
  for (const clue of context.clues) {
    const analysis = analyzeClue(context, domains, clue, remainingByCode);
    if (analysis.usable && !analysis.feasible) {
      return { feasible: false, domains };
    }
    analyses.push(analysis);
  }
  const updated = domains.slice();
  for (let cellIndex = 0; cellIndex < context.cellCount; cellIndex += 1) {
    const domain = domains[cellIndex]!;
    let consistentDomain = 0;
    for (let code = 0; code < codeCount; code += 1) {
      if (
        (domain & (1 << code)) !== 0 &&
        analyses.every((analysis) =>
          isConsistentWithClue(analysis, cellIndex, code),
        )
      ) {
        consistentDomain |= 1 << code;
      }
    }
    if (consistentDomain === 0) {
      return { feasible: false, domains };
    }
    updated[cellIndex] = consistentDomain;
  }
  return { feasible: true, domains: updated };
}

function countFixedCodes(domains: Domains): number[] {
  const fixed = new Array<number>(codeCount).fill(0);
  for (const domain of domains) {
    if (isSingleton(domain)) {
      fixed[singletonCode(domain)]! += 1;
    }
  }
  return fixed;
}

/** 番号ごとの、置き場所の決まっていないマスへまだ使える数。 */
function countRemainingCodes(
  context: SolverContext,
  domains: Domains,
): number[] {
  const fixed = countFixedCodes(domains);
  return context.required.map((count, code) => count - fixed[code]!);
}

function listPossibleCells(domains: Domains, code: number): number[] {
  const cells: number[] = [];
  for (const [cellIndex, domain] of domains.entries()) {
    if ((domain & (1 << code)) !== 0) {
      cells.push(cellIndex);
    }
  }
  return cells;
}

function isInventoryFeasible(
  context: SolverContext,
  domains: Domains,
): boolean {
  if (domains.includes(0)) {
    return false;
  }
  const fixed = countFixedCodes(domains);
  return context.required.every(
    (count, code) =>
      fixed[code]! <= count && count <= listPossibleCells(domains, code).length,
  );
}

/**
 * 在庫の推論。ある番号を必要数だけ置き終えたら他のマスから除き、置けるマスの数が必要数ちょうどならそこへ置く。
 * 変化が無くなるまで繰り返す。
 */
function applyInventory(
  context: SolverContext,
  domains: Domains,
): NarrowResult {
  if (!isInventoryFeasible(context, domains)) {
    return { feasible: false, domains };
  }
  const updated = domains.slice();
  let changed = true;
  while (changed) {
    changed = false;
    const fixed = countFixedCodes(updated);
    const possibleCells = context.required.map((_, code) =>
      listPossibleCells(updated, code),
    );
    for (const [code, count] of context.required.entries()) {
      const cells = possibleCells[code]!;
      if (fixed[code]! > count || cells.length < count) {
        return { feasible: false, domains };
      }
      if (fixed[code] === count) {
        for (const [cellIndex, domain] of updated.entries()) {
          if (!isSingleton(domain) && (domain & (1 << code)) !== 0) {
            updated[cellIndex] = domain & ~(1 << code);
            changed = true;
          }
        }
      } else if (cells.length === count) {
        for (const cellIndex of cells) {
          if (updated[cellIndex] !== 1 << code) {
            updated[cellIndex] = 1 << code;
            changed = true;
          }
        }
      }
    }
  }
  return {
    feasible: isInventoryFeasible(context, updated),
    domains: updated,
  };
}

function isSameDomains(left: Domains, right: Domains): boolean {
  return left.every((domain, cellIndex) => domain === right[cellIndex]);
}

/** 仮定をせず、直接整合性と在庫を変化が無くなるまで繰り返す。`rounds` は候補が変わった回数。 */
function propagateWithoutAssumption(
  context: SolverContext,
  start: Domains,
): NarrowResult & { rounds: number } {
  let domains = start;
  let rounds = 0;
  while (true) {
    const before = domains;
    const consistency = applyCandidateConsistency(context, domains, true);
    if (!consistency.feasible) {
      return { feasible: false, domains: consistency.domains, rounds };
    }
    const inventory = applyInventory(context, consistency.domains);
    if (!inventory.feasible) {
      return { feasible: false, domains: inventory.domains, rounds };
    }
    domains = inventory.domains;
    if (isSameDomains(domains, before)) {
      return { feasible: true, domains, rounds };
    }
    rounds += 1;
  }
}

function countFixedPieces(domains: Domains): number {
  let count = 0;
  for (const domain of domains) {
    if (isSingleton(domain) && domain !== emptyBit) {
      count += 1;
    }
  }
  return count;
}

/** 手持ちの全ピースの置き場所が決まったか。空きマスが決まっているかは問わない。 */
function isPlacementComplete(
  context: SolverContext,
  domains: Domains,
): boolean {
  const fixed = countFixedCodes(domains);
  return context.required.every(
    (count, code) => code === 0 || fixed[code] === count,
  );
}

function countUnresolvedCells(domains: Domains): number {
  let count = 0;
  for (const domain of domains) {
    if (!isSingleton(domain) && (domain & ~emptyBit) !== 0) {
      count += 1;
    }
  }
  return count;
}

/** 単一ヒント: 各ヒントが単独で1つに絞った必ず通るマスをその番号に決める。別々のヒントが違う番号に絞ったら矛盾。 */
function applySingleClueDeduction(
  context: SolverContext,
  domains: Domains,
): NarrowResult {
  const forced = new Map<number, number>();
  for (const clue of context.clues) {
    const analysis = analyzeClue(context, domains, clue, null);
    if (!analysis.usable) {
      continue;
    }
    if (!analysis.feasible) {
      return { feasible: false, domains };
    }
    for (let cellIndex = 0; cellIndex < context.cellCount; cellIndex += 1) {
      const narrowed = domains[cellIndex]! & analysis.usedCodes[cellIndex]!;
      if (analysis.mustCells[cellIndex] === 1 && isSingleton(narrowed)) {
        forced.set(cellIndex, (forced.get(cellIndex) ?? 0) | narrowed);
      }
    }
  }
  const updated = domains.slice();
  for (const [cellIndex, pieces] of forced) {
    if (!isSingleton(pieces)) {
      return { feasible: false, domains };
    }
    updated[cellIndex] = pieces;
  }
  return { feasible: true, domains: updated };
}

/** 仮定と矛盾で除ける最初の候補（マスの並び順・番号順）を除く。除ける候補が無ければ `null`。 */
function eliminateFirstContradictingAssumption(
  context: SolverContext,
  domains: Domains,
  counter: { tests: number },
): Domains | null {
  for (let cellIndex = 0; cellIndex < context.cellCount; cellIndex += 1) {
    const domain = domains[cellIndex]!;
    if (isSingleton(domain)) {
      continue;
    }
    for (let code = 0; code < codeCount; code += 1) {
      if ((domain & (1 << code)) === 0) {
        continue;
      }
      counter.tests += 1;
      const assumed = domains.slice();
      assumed[cellIndex] = 1 << code;
      if (!propagateWithoutAssumption(context, assumed).feasible) {
        const eliminated = domains.slice();
        eliminated[cellIndex] = domain & ~(1 << code);
        return eliminated;
      }
    }
  }
  return null;
}

class HumanSolveProgress {
  readonly fixedPieceCountByLevel: [number, number, number, number, number] = [
    0, 0, 0, 0, 0,
  ];
  propagationRoundCount = 0;
  readonly assumptions = { tests: 0 };
  assumptionEliminationCount = 0;
  private fixedBeforeLevel = 0;
  domains: Domains;

  constructor(
    private readonly context: SolverContext,
    initial: Domains,
    private readonly observeDomains: ReflectionHumanSolveOptions["observeDomains"],
  ) {
    this.domains = initial;
  }

  beginLevel(): void {
    this.fixedBeforeLevel = countFixedPieces(this.domains);
  }

  update(domains: Domains): void {
    this.domains = domains;
    this.observeDomains?.(domains);
  }

  endLevel(level: ReflectionReasoningLevel): void {
    this.fixedPieceCountByLevel[level - 1] = Math.max(
      0,
      countFixedPieces(this.domains) - this.fixedBeforeLevel,
    );
  }

  isComplete(): boolean {
    return isPlacementComplete(this.context, this.domains);
  }

  finish(
    status: ReflectionHumanSolveTrace["status"],
    highestLevel: ReflectionReasoningLevel | null,
  ): ReflectionHumanSolveTrace {
    const unresolvedCellCount =
      status === "contradiction"
        ? this.context.cellCount
        : status === "unresolved"
          ? countUnresolvedCells(this.domains)
          : 0;
    return {
      status,
      highestLevel,
      fixedPieceCountByLevel: this.fixedPieceCountByLevel,
      propagationRoundCount: this.propagationRoundCount,
      assumptionTestCount: this.assumptions.tests,
      assumptionEliminationCount: this.assumptionEliminationCount,
      unresolvedCellCount,
    };
  }
}

type LevelOutcome = "complete" | "incomplete" | "contradiction";

function solveBySingleClues(
  progress: HumanSolveProgress,
  context: SolverContext,
): LevelOutcome {
  progress.beginLevel();
  const result = applySingleClueDeduction(context, progress.domains);
  if (!result.feasible) {
    return "contradiction";
  }
  progress.update(result.domains);
  progress.endLevel(1);
  return progress.isComplete() ? "complete" : "incomplete";
}

function solveByDirectConsistency(
  progress: HumanSolveProgress,
  context: SolverContext,
): LevelOutcome {
  progress.beginLevel();
  const result = applyCandidateConsistency(context, progress.domains);
  if (!result.feasible) {
    return "contradiction";
  }
  progress.update(result.domains);
  progress.endLevel(2);
  progress.propagationRoundCount = 1;
  return progress.isComplete() ? "complete" : "incomplete";
}

function solveByPropagation(
  progress: HumanSolveProgress,
  context: SolverContext,
): LevelOutcome {
  progress.beginLevel();
  while (true) {
    const previous = progress.domains;
    const result = applyCandidateConsistency(context, previous);
    if (!result.feasible) {
      return "contradiction";
    }
    progress.update(result.domains);
    if (isSameDomains(result.domains, previous)) {
      break;
    }
    progress.propagationRoundCount += 1;
    if (progress.isComplete()) {
      progress.endLevel(3);
      return "complete";
    }
  }
  progress.endLevel(3);
  return "incomplete";
}

function solveWithInventory(
  progress: HumanSolveProgress,
  context: SolverContext,
): LevelOutcome {
  progress.beginLevel();
  const result = propagateWithoutAssumption(context, progress.domains);
  progress.propagationRoundCount += result.rounds;
  if (!result.feasible) {
    return "contradiction";
  }
  progress.update(result.domains);
  progress.endLevel(4);
  return progress.isComplete() ? "complete" : "incomplete";
}

function solveByAssumption(
  progress: HumanSolveProgress,
  context: SolverContext,
): LevelOutcome {
  progress.beginLevel();
  while (!progress.isComplete()) {
    const eliminated = eliminateFirstContradictingAssumption(
      context,
      progress.domains,
      progress.assumptions,
    );
    if (eliminated === null) {
      break;
    }
    progress.update(eliminated);
    progress.assumptionEliminationCount += 1;
    const result = propagateWithoutAssumption(context, eliminated);
    progress.propagationRoundCount += result.rounds;
    if (!result.feasible) {
      return "contradiction";
    }
    progress.update(result.domains);
  }
  progress.endLevel(5);
  return progress.isComplete() ? "complete" : "incomplete";
}

const levelSolvers = [
  solveBySingleClues,
  solveByDirectConsistency,
  solveByPropagation,
  solveWithInventory,
  solveByAssumption,
] as const satisfies readonly ((
  progress: HumanSolveProgress,
  context: SolverContext,
) => LevelOutcome)[];

/**
 * 外周ヒントと手持ちから、人間の推論をレベル1から順に使って置き場所を決めていく。
 * 浅いレベルで決まり切ればそこで止め、決まり切らなければ次のレベルの推論を加える。
 * 仮定の順はマスの並び順・番号順、光路の探索量の上限は歩数で固定しているので、同じ入力には同じ結果を返す。
 * レベルの手順は研究用 Python（`scripts/research/reflection_difficulty_experiment.py` の `analyze_problem`）と同じ。
 * 光路の扱いは Python より厳密で（同じマスを別のピースとして通る並びと、残り数を超える並びを除く）、推論レベルは浅く出る。
 */
export function traceReflectionHumanSolve(
  input: ReflectionHumanSolveInput,
  { observeDomains }: ReflectionHumanSolveOptions = {},
): ReflectionHumanSolveTrace {
  const context = createContext(input);
  const allowed = context.required.reduce(
    (mask, count, code) =>
      code === 0 || count > 0 ? mask | (1 << code) : mask,
    0,
  );
  const progress = new HumanSolveProgress(
    context,
    new Uint8Array(context.cellCount).fill(allowed),
    observeDomains,
  );
  for (const [order, solveLevel] of levelSolvers.entries()) {
    const outcome = solveLevel(progress, context);
    if (outcome === "contradiction") {
      return progress.finish("contradiction", null);
    }
    if (outcome === "complete") {
      return progress.finish("solved", reflectionReasoningLevels[order]!);
    }
  }
  return progress.finish("unresolved", null);
}
