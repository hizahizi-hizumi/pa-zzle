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
 * - `4` 在庫: 手持ちの残り数と置ける場所の数を合わせ、光路の制約と行き来して決める。
 * - `5` 仮定と矛盾: 候補を1つ仮に置き、2〜4を進めた先で矛盾が出る候補を除く。
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
 * - `reached` / `viable` / `layers`: ヒント1本を調べるときの作業領域。距離と状態の組で引く。
 * - `clueAnalysisCache`: ヒントごとの、調べた結果と、そのとき光が届いたマスの候補。
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
  visitMarks: Int32Array;
  visitGeneration: number;
  frontier: Int32Array;
  nextFrontier: Int32Array;
  clueAnalysisCache: CachedClueAnalysis[][];
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
    visitMarks: new Int32Array(stateCount),
    visitGeneration: 0,
    frontier: new Int32Array(stateCount),
    nextFrontier: new Int32Array(stateCount),
    clueAnalysisCache: solverClues.map(() => []),
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

/**
 * 1本のヒントを満たす光路（距離ごとの状態の並び）の集まりを調べた結果。
 * 同じマスを別の距離で通るときに別の番号を使う並びも光路として数えるので、実際の配置より緩い（正しい候補は落とさない）。
 * - `usedCodes`: マスごとの、どれかの光路でそのマスに使われる番号。どの光路も通らないマスは0。
 * - `mustCells`: どの光路も必ず通るマス。
 * - `firstPathDepth` / `lastPathDepth`: マスごとの、光路がそのマスを通り得る最初と最後の距離。通らなければ0。
 *   両者が違うマスは、1本の光路が2回以上通り得る。
 * - `pathStates`: どれかの光路に乗る状態。距離と状態の組で引く。
 * - `pathLayers` / `pathLayerOffsets`: 光路に乗る状態を距離ごとに並べたもの。距離 `depth` の区間は
 *   `pathLayerOffsets[depth]` から `pathLayerOffsets[depth + 1]` の手前まで。
 * - `forcedFeasibility`: マスを番号に固定したときに光路が残るかを、たどり直した結果（キーは `cellIndex * 8 + code`）。
 *   結果は光が届き得るマスの候補だけで決まるので、同じ `ClueAnalysis` を使い回す間は変わらない。
 */
type ClueAnalysis = {
  feasible: boolean;
  usedCodes: Uint8Array;
  mustCells: Uint8Array;
  firstPathDepth: Int32Array;
  lastPathDepth: Int32Array;
  pathStates: Uint8Array;
  pathLayers: Int32Array;
  pathLayerOffsets: Int32Array;
  forcedFeasibility: Map<number, boolean>;
};

/**
 * ヒント1本を調べるときに読むのは、光が届き得るマスの候補だけなので、それらが同じなら結果も同じ。
 * 仮定を1つずつ試すと、仮に置いたマスへ光が届かないヒントは同じ候補で何度も調べ直すことになるため、結果を使い回す。
 */
type CachedClueAnalysis = {
  readCells: Int32Array;
  readDomains: Uint8Array;
  analysis: ClueAnalysis;
};

const MAXIMUM_CACHED_ANALYSES_PER_CLUE = 8;

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

/** 後ろ向きに、ヒントどおりに終われる状態へ印を付ける。 */
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

function listReadCells(
  context: SolverContext,
  clue: SolverClue,
  layerSizes: readonly number[],
): Int32Array {
  const { stateCount, layers } = context;
  const isRead = new Uint8Array(context.cellCount);
  const cells: number[] = [];
  for (let depth = 1; depth <= clue.distance; depth += 1) {
    for (let order = 0; order < layerSizes[depth]!; order += 1) {
      const cellIndex = layers[depth * stateCount + order]! >> 2;
      if (isRead[cellIndex] === 0) {
        isRead[cellIndex] = 1;
        cells.push(cellIndex);
      }
    }
  }
  return Int32Array.from(cells);
}

function findCachedAnalysis(
  cache: readonly CachedClueAnalysis[],
  domains: Domains,
): ClueAnalysis | null {
  const cached = cache.find(({ readCells, readDomains }) =>
    readCells.every(
      (cellIndex, order) => domains[cellIndex] === readDomains[order],
    ),
  );
  return cached?.analysis ?? null;
}

function analyzeClue(
  context: SolverContext,
  domains: Domains,
  clue: SolverClue,
): ClueAnalysis {
  const cache = context.clueAnalysisCache[clue.entryOrder]!;
  const cached = findCachedAnalysis(cache, domains);
  if (cached !== null) {
    return cached;
  }
  const layerSizes = listReachedStates(context, domains, clue);
  const readCells = listReadCells(context, clue, layerSizes);
  const analysis = analyzeReachedClue(context, domains, clue, layerSizes);
  if (cache.length >= MAXIMUM_CACHED_ANALYSES_PER_CLUE) {
    cache.shift();
  }
  cache.push({
    readCells,
    readDomains: Uint8Array.from(readCells, (cellIndex) => domains[cellIndex]!),
    analysis,
  });
  return analysis;
}

function analyzeReachedClue(
  context: SolverContext,
  domains: Domains,
  clue: SolverClue,
  layerSizes: readonly number[],
): ClueAnalysis {
  const { cellCount, stateCount, viable, transitions } = context;
  const usedCodes = new Uint8Array(cellCount);
  const mustCells = new Uint8Array(cellCount);
  const firstPathDepth = new Int32Array(cellCount);
  const lastPathDepth = new Int32Array(cellCount);
  const pathStates = new Uint8Array((clue.distance + 2) * stateCount);
  const pathLayers: number[] = [];
  const pathLayerOffsets = new Int32Array(clue.distance + 2);
  const infeasible = {
    feasible: false,
    usedCodes,
    mustCells,
    firstPathDepth,
    lastPathDepth,
    pathStates,
    pathLayers: new Int32Array(0),
    pathLayerOffsets,
    forcedFeasibility: new Map<number, boolean>(),
  };
  markViableStates(context, domains, clue, layerSizes);
  if (viable[stateCount + clue.startState] === 0) {
    return infeasible;
  }

  const wordCount = Math.ceil(cellCount / 32);
  function withCell(cells: Uint32Array, cellIndex: number): Uint32Array {
    const copied = cells.slice();
    copied[cellIndex >> 5]! |= 1 << (cellIndex & 31);
    return copied;
  }

  let prefixMustCellsByState = new Map<LaserState, Uint32Array>([
    [
      clue.startState,
      withCell(new Uint32Array(wordCount), clue.startState >> 2),
    ],
  ]);
  let completeMust: Uint32Array | null = null;
  for (let depth = 1; depth <= clue.distance; depth += 1) {
    const nextPrefixMustCellsByState = new Map<LaserState, Uint32Array>();
    const nextOffset = (depth + 1) * stateCount;
    pathLayerOffsets[depth] = pathLayers.length;
    for (const [state, must] of prefixMustCellsByState) {
      pathStates[depth * stateCount + state] = 1;
      pathLayers.push(state);
      const cellIndex = state >> 2;
      if (firstPathDepth[cellIndex] === 0) {
        firstPathDepth[cellIndex] = depth;
      }
      lastPathDepth[cellIndex] = depth;
      const domain = domains[cellIndex]!;
      for (let code = 0; code < codeCount; code += 1) {
        if ((domain & (1 << code)) === 0) {
          continue;
        }
        const transition = transitions[state * codeCount + code]!;
        if (endsAsClue(clue, transition, depth)) {
          usedCodes[cellIndex]! |= 1 << code;
          if (completeMust === null) {
            completeMust = must.slice();
          } else {
            for (let word = 0; word < wordCount; word += 1) {
              completeMust[word]! &= must[word]!;
            }
          }
          continue;
        }
        const next = continuesInside(clue, transition, depth);
        if (next < 0 || viable[nextOffset + next] === 0) {
          continue;
        }
        usedCodes[cellIndex]! |= 1 << code;
        const nextMust = withCell(must, next >> 2);
        const existing = nextPrefixMustCellsByState.get(next);
        if (existing === undefined) {
          nextPrefixMustCellsByState.set(next, nextMust);
        } else {
          for (let word = 0; word < wordCount; word += 1) {
            existing[word]! &= nextMust[word]!;
          }
        }
      }
    }
    prefixMustCellsByState = nextPrefixMustCellsByState;
  }
  pathLayerOffsets[clue.distance + 1] = pathLayers.length;
  if (completeMust === null) {
    return infeasible;
  }
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    mustCells[cellIndex] =
      (completeMust[cellIndex >> 5]! >>> (cellIndex & 31)) & 1;
  }
  return {
    feasible: true,
    usedCodes,
    mustCells,
    firstPathDepth,
    lastPathDepth,
    pathStates,
    pathLayers: Int32Array.from(pathLayers),
    pathLayerOffsets,
    forcedFeasibility: new Map(),
  };
}

/**
 * マス `forcedCell` を何度通っても番号 `forcedCode` として扱ったとき、ヒントを満たす光路があるか。
 * そのような光路は固定しないときの光路でもあるので、光路に乗る状態だけをたどる。
 * そのマスを初めて通り得る距離より前の状態へは、そのマスを通らずに届く。最後に通り得る距離より後の状態からは、
 * そのマスを通らずに終われる。そのため、その間の距離だけをたどる。
 */
function isFeasibleWithForcedCode(
  context: SolverContext,
  domains: Domains,
  clue: SolverClue,
  analysis: ClueAnalysis,
  forcedCell: number,
  forcedCode: number,
): boolean {
  const { transitions, visitMarks, stateCount } = context;
  const { pathStates, pathLayers, pathLayerOffsets } = analysis;
  const firstDepth = analysis.firstPathDepth[forcedCell]!;
  const lastDepth = analysis.lastPathDepth[forcedCell]!;
  let frontier = context.frontier;
  let nextFrontier = context.nextFrontier;
  let frontierSize = 0;
  for (
    let order = pathLayerOffsets[firstDepth]!;
    order < pathLayerOffsets[firstDepth + 1]!;
    order += 1
  ) {
    frontier[frontierSize] = pathLayers[order]!;
    frontierSize += 1;
  }
  for (let depth = firstDepth; depth <= lastDepth; depth += 1) {
    context.visitGeneration += 1;
    const generation = context.visitGeneration;
    const nextOffset = (depth + 1) * stateCount;
    let nextSize = 0;
    for (let order = 0; order < frontierSize; order += 1) {
      const state = frontier[order]!;
      const cellIndex = state >> 2;
      const domain =
        cellIndex === forcedCell
          ? domains[cellIndex]! & (1 << forcedCode)
          : domains[cellIndex]!;
      for (let code = 0; code < codeCount; code += 1) {
        if ((domain & (1 << code)) === 0) {
          continue;
        }
        const transition = transitions[state * codeCount + code]!;
        if (endsAsClue(clue, transition, depth)) {
          return true;
        }
        const next = continuesInside(clue, transition, depth);
        if (
          next >= 0 &&
          pathStates[nextOffset + next] === 1 &&
          visitMarks[next] !== generation
        ) {
          visitMarks[next] = generation;
          nextFrontier[nextSize] = next;
          nextSize += 1;
        }
      }
    }
    if (nextSize === 0) {
      return false;
    }
    [frontier, nextFrontier] = [nextFrontier, frontier];
    frontierSize = nextSize;
  }
  return frontierSize > 0;
}

/**
 * マスを番号に固定してもヒントを満たせるか。光路の集まりから決まる場合はたどり直さない。
 * - どの光路も通らないマスなら、固定しても光路は残る。
 * - どの光路もそのマスでその番号を使わないなら、そのマスを通らない光路があるときだけ満たせる。
 * - どの光路もそのマスでその番号だけを使うなら、固定しても光路は残る。
 * - そのマスでその番号を使う光路があり、どの光路もそのマスを1回しか通らないなら、その光路が残る。
 */
function isConsistentWithClue(
  context: SolverContext,
  domains: Domains,
  clue: SolverClue,
  analysis: ClueAnalysis,
  cellIndex: number,
  code: number,
): boolean {
  const used = analysis.usedCodes[cellIndex]!;
  const bit = 1 << code;
  if (used === 0 || used === bit) {
    return true;
  }
  if ((used & bit) === 0) {
    return analysis.mustCells[cellIndex] === 0;
  }
  if (
    analysis.firstPathDepth[cellIndex] === analysis.lastPathDepth[cellIndex]
  ) {
    return true;
  }
  const key = cellIndex * 8 + code;
  const known = analysis.forcedFeasibility.get(key);
  if (known !== undefined) {
    return known;
  }
  const feasible = isFeasibleWithForcedCode(
    context,
    domains,
    clue,
    analysis,
    cellIndex,
    code,
  );
  analysis.forcedFeasibility.set(key, feasible);
  return feasible;
}

/**
 * 直接整合性（レベル2の1回分）。各マスの各候補を固定したとき、全ヒントのどれかが満たせなくなる候補を除く。
 * 全マスを呼び出し時の候補に照らしてから、まとめて更新する。
 */
function applyCandidateConsistency(
  context: SolverContext,
  domains: Domains,
): NarrowResult {
  const analyses: ClueAnalysis[] = [];
  for (const clue of context.clues) {
    const analysis = analyzeClue(context, domains, clue);
    if (!analysis.feasible) {
      return { feasible: false, domains };
    }
    analyses.push(analysis);
  }
  const updated = domains.slice();
  for (let cellIndex = 0; cellIndex < context.cellCount; cellIndex += 1) {
    const domain = domains[cellIndex]!;
    let consistentDomain = 0;
    for (let code = 0; code < codeCount; code += 1) {
      if ((domain & (1 << code)) === 0) {
        continue;
      }
      const consistent = context.clues.every((clue, order) =>
        isConsistentWithClue(
          context,
          domains,
          clue,
          analyses[order]!,
          cellIndex,
          code,
        ),
      );
      if (consistent) {
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
    const consistency = applyCandidateConsistency(context, domains);
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
    const analysis = analyzeClue(context, domains, clue);
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
 * 仮定の順はマスの並び順・番号順に固定しているので、同じ入力には同じ結果を返す。
 * 研究用 Python（`scripts/research/reflection_difficulty_experiment.py` の `analyze_problem`）と同じ手順。
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
