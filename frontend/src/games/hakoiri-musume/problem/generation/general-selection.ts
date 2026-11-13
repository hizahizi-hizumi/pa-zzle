import {
  classifyHakoiriMusumeFeatures,
  type HakoiriMusumeDifficulty,
} from "@/games/hakoiri-musume/difficulty";
import {
  createHakoiriMusumeFamilyLayout,
  createHakoiriMusumeFamilyPieceTypes,
  type HakoiriMusumeFamily,
  type HakoiriMusumePieceSet,
  hakoiriMusumeLevelSelections,
} from "@/games/hakoiri-musume/problem/generation/families";
import {
  createHakoiriMusumeGeneralGraph,
  type HakoiriMusumeGeneralGraph,
  type HakoiriMusumeGeneralMeasures,
  measureHakoiriMusumeGeneralGraph,
  measureHakoiriMusumeOptimal,
} from "@/games/hakoiri-musume/problem/generation/general-measure";
import {
  createHakoiriMusumeSpace,
  decodeHakoiriMusumeState,
  enumerateHakoiriMusumeGoalStates,
  findHakoiriMusumeTargetPlacement,
  type HakoiriMusumeSpace,
  type HakoiriMusumeStateKey,
  isHakoiriMusumeGoalState,
  listHakoiriMusumeMoves,
  mirrorHakoiriMusumeState,
} from "@/games/hakoiri-musume/problem/generation/general-space";
import { confirmHakoiriMusumeNormalForm } from "@/games/hakoiri-musume/problem/generation/general-witness";
import { hakoiriMusumePieceShapes } from "@/games/hakoiri-musume/puzzle/board";

export type HakoiriMusumePickedProblem = {
  key: HakoiriMusumeStateKey;
  optimalMoveCount: number;
  preparationLength: number;
  daughterDetourCount: number;
  shortestPreparationLength: number;
};

/** 駒の組を分析した結果。`graph`・`measures` は解ける盤面の全部。 */
export type HakoiriMusumePieceSetAnalysis = {
  space: HakoiriMusumeSpace;
  graph: HakoiriMusumeGeneralGraph;
  measures: HakoiriMusumeGeneralMeasures;
  components: Int32Array;
};

/** 族の駒の組の解ける盤面の全部を分析する。盤面が `stateCap` を超える組は `null`（大きすぎて使わない）。 */
export function analyzeHakoiriMusumeFamilyPieceSet(
  family: HakoiriMusumeFamily,
  pieceSet: HakoiriMusumePieceSet,
  stateCap: number,
): HakoiriMusumePieceSetAnalysis | null {
  const space = createHakoiriMusumeSpace({
    layout: createHakoiriMusumeFamilyLayout(family),
    types: createHakoiriMusumeFamilyPieceTypes(family, pieceSet),
  });
  const graph = createHakoiriMusumeGeneralGraph(
    space,
    enumerateHakoiriMusumeGoalStates(space),
    stateCap,
  );
  if (!graph) {
    return null;
  }
  const measures = measureHakoiriMusumeGeneralGraph(graph);
  return { space, graph, measures, components: labelComponents(graph) };
}

function labelComponents(graph: HakoiriMusumeGeneralGraph): Int32Array {
  const labels = new Int32Array(graph.keys.length).fill(-1);
  let next = 0;
  for (let start = 0; start < labels.length; start += 1) {
    if (labels[start] !== -1) {
      continue;
    }
    labels[start] = next;
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (
        let edge = graph.edgeStarts[current]!;
        edge < graph.edgeStarts[current + 1]!;
        edge += 1
      ) {
        const target = graph.edges[edge]!;
        if (labels[target] === -1) {
          labels[target] = next;
          stack.push(target);
        }
      }
    }
    next += 1;
  }
  return labels;
}

/** 壁は入れない。駒の組で決まる。 */
function countEmptyCells(space: HakoiriMusumeSpace): number {
  return (
    space.cellCount -
    space.spec.layout.walls.length -
    space.types.reduce(
      (sum, type) =>
        sum + type.count * hakoiriMusumePieceShapes[type.kind].cells.length,
      0,
    )
  );
}

/** 範囲外なら `null`。 */
export function classifyHakoiriMusumeFamilyState(
  family: HakoiriMusumeFamily,
  measures: HakoiriMusumeGeneralMeasures,
  state: number,
  emptyCellCount: number,
): HakoiriMusumeDifficulty | null {
  const assessment = classifyHakoiriMusumeFeatures({
    optimalMoveCount: measures.optimal[state]!,
    preparationLength: measures.preparation[state]! + family.levelOffset,
    daughterDetourCount: measures.detour[state]!,
    emptyCellCount,
    shortestPreparationLength: measures.shortestPreparation[state]!,
  });
  return assessment.status === "classified" ? assessment.difficulty : null;
}

/** 出口の辺に直交する向きの、行き先からの離れの2倍が、その最大 + 1 以上なら遠い。 */
function isTargetFar(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
  target: number,
) {
  const type = space.types[target]!;
  const placement = findHakoiriMusumeTargetPlacement(space, key, target);
  return 2 * type.normals[placement]! >= type.maxNormal + 1;
}

/**
 * 余計な駒の確かめ（Fogleman）。目標でない駒を1つ取り除いた盤が、元の最短手数より少ない手数で解けないなら、その駒は手を増やして
 * いない余計な駒。取り除いた盤は、同じ盤の作りで、その形の駒が1つ少ない組の盤面なので、その組の解ける盤面の全部の最短手数を
 * 一度だけ求めて引く。組の盤面が `tableStateCap` を超えるときは、取り除いた盤から `searchStateCap` 個までたどって探し、
 * 調べきれなければ `null`。余計な駒があれば `true`。
 */
export type HakoiriMusumeSuperfluousCheck = (
  key: HakoiriMusumeStateKey,
  optimalMoveCount: number,
) => boolean | null;

export function createHakoiriMusumeSuperfluousCheck(
  space: HakoiriMusumeSpace,
  tableStateCap: number,
  searchStateCap: number,
): HakoiriMusumeSuperfluousCheck {
  const tables = new Map<
    number,
    {
      space: HakoiriMusumeSpace;
      optimal: ReadonlyMap<HakoiriMusumeStateKey, number> | null;
    }
  >();
  const tableFor = (type: number) => {
    let table = tables.get(type);
    if (!table) {
      const reduced = createHakoiriMusumeSpace({
        layout: space.spec.layout,
        types: space.spec.types.map((pieceType, index) =>
          index === type
            ? { ...pieceType, count: pieceType.count - 1 }
            : pieceType,
        ),
      });
      const graph = createHakoiriMusumeGeneralGraph(
        reduced,
        enumerateHakoiriMusumeGoalStates(reduced),
        tableStateCap,
      );
      let optimal: Map<HakoiriMusumeStateKey, number> | null = null;
      if (graph) {
        const values = measureHakoiriMusumeOptimal(graph);
        optimal = new Map(
          graph.keys.map((key, index) => [key, values[index]!]),
        );
      }
      table = { space: reduced, optimal };
      tables.set(type, table);
    }
    return table;
  };
  return (key, optimalMoveCount) => {
    let unknown = false;
    for (const { type, placement } of decodeHakoiriMusumeState(space, key)) {
      if (space.types[type]!.target !== null) {
        continue;
      }
      const firstCell = space.types[type]!.firstCells[placement]!;
      const reducedKey = `${key.slice(0, firstCell)}0${key.slice(firstCell + 1)}`;
      const table = tableFor(type);
      if (table.optimal) {
        const optimal = table.optimal.get(reducedKey);
        if (optimal === undefined || optimal >= optimalMoveCount) {
          return true;
        }
        continue;
      }
      const searched = searchWithin(
        table.space,
        reducedKey,
        optimalMoveCount - 1,
        searchStateCap,
      );
      if (searched === false) {
        return true;
      }
      unknown ||= searched === null;
    }
    return unknown ? null : false;
  };
}

/** `start` から `depth` 手以内に解けるか。たどる盤面が `cap` を超えたら `null`。 */
function searchWithin(
  space: HakoiriMusumeSpace,
  start: HakoiriMusumeStateKey,
  depth: number,
  cap: number,
): boolean | null {
  if (isHakoiriMusumeGoalState(space, start)) {
    return true;
  }
  let frontier = [start];
  const seen = new Set(frontier);
  for (let step = 1; step <= depth && frontier.length > 0; step += 1) {
    const following: HakoiriMusumeStateKey[] = [];
    for (const current of frontier) {
      for (const move of listHakoiriMusumeMoves(space, current)) {
        if (seen.has(move.key)) {
          continue;
        }
        if (isHakoiriMusumeGoalState(space, move.key)) {
          return true;
        }
        seen.add(move.key);
        following.push(move.key);
      }
      if (seen.size > cap) {
        return null;
      }
    }
    frontier = following;
  }
  return false;
}

/** 候補の並びを seed と盤面で決めるのに使う FNV-1a。 */
function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export type HakoiriMusumePieceSetPicks = {
  picked: Record<HakoiriMusumeDifficulty, HakoiriMusumePickedProblem[]>;
  rejected: Record<string, number>;
};

const pickingOrder = [
  "5",
  "4",
  "3",
  "2",
  "1",
] as const satisfies readonly HakoiriMusumeDifficulty[];

/** 1つの盤面から手を何手まで「近い」とみなすか。 */
const NEAR_MOVE_COUNT = 4;
/** 最短解の後半がこの割合以上重なる2問は、解き筋の大半が重なるとみなす。 */
const MERGE_SHARE = 0.75;
/** 空きがこの数以上で準備の長さが 0 の問題は、触るだけで解けるので採らない。 */
const TOUCH_SOLVABLE_EMPTY_CELLS = 6;
const MAX_SMALL_PIECES = 6;

/**
 * 駒の組から、レベルごとに `limit` 問まで採る。上のレベルから順に、レベルの採り方に合う候補を、段（1つ目の目標が遠い・目標がすべて
 * 遠い・始めから目標が動けず初手が1つでない）の順、同じ段は seed と盤面の hash の順に見て、次をすべて満たすものを採る。
 * - 同じレベルで採った問題（と左右反転）から4手以内でなく、その最短解の祖先・子孫でなく、最短解の後半の 3/4 以上が合流しない。
 * - 上のレベルで採った問題から4手以内でなく、その最短解の祖先・子孫でない。
 * - 連結成分の上限と、同じ最終局面の上限に達していない。
 * - 準備の長さと遠回りを正規形の解で確かめられる。
 * - 余計な駒が無い（調べきれない駒は数に入れて採る）。
 */
export function pickHakoiriMusumePieceSetProblems(
  family: HakoiriMusumeFamily,
  analysis: HakoiriMusumePieceSetAnalysis,
  seed: string,
  limit: number,
  hasSuperfluousPiece: HakoiriMusumeSuperfluousCheck,
): HakoiriMusumePieceSetPicks {
  const { space, graph, measures, components } = analysis;
  const { optimal, preparation, detour, shortestPreparation } = measures;
  const { edgeStarts, edges, movers } = graph;
  const count = graph.keys.length;
  const emptyCellCount = countEmptyCells(space);
  const mirrorIndex = new Int32Array(count).fill(-1);
  if (space.mirrorable) {
    for (let state = 0; state < count; state += 1) {
      mirrorIndex[state] =
        graph.indexByKey.get(
          mirrorHakoiriMusumeState(space, graph.keys[state]!),
        ) ?? -1;
    }
  }
  const isChosenOrientation = (state: number) => {
    const mirror = mirrorIndex[state]!;
    if (mirror < 0 || mirror === state) {
      return true;
    }
    const own = graph.keys[state]!;
    const other = graph.keys[mirror]!;
    const lower = own < other ? own : other;
    const pickLower = hashText(`${seed}:orientation:${lower}`) % 2 === 0;
    return pickLower ? own === lower : own !== lower;
  };
  const smallType = space.types.findIndex(
    (type) => type.target === null && type.kind === "small",
  );
  const smallCount = smallType >= 0 ? space.types[smallType]!.count : 0;
  const rejected: Record<string, number> = {};
  const reject = (reason: string) => {
    rejected[reason] = (rejected[reason] ?? 0) + 1;
  };
  const byLevel: Record<HakoiriMusumeDifficulty, number[]> = {
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
  };
  if (smallCount <= MAX_SMALL_PIECES) {
    for (let state = 0; state < count; state += 1) {
      if (optimal[state]! <= 0 || !isChosenOrientation(state)) {
        continue;
      }
      const level = classifyHakoiriMusumeFamilyState(
        family,
        measures,
        state,
        emptyCellCount,
      );
      if (level !== null) {
        byLevel[level].push(state);
      }
    }
  }
  const markNear = (marks: Uint8Array, origin: number) => {
    let frontier = [origin];
    const reached = new Set(frontier);
    marks[origin] = 1;
    for (let step = 0; step < NEAR_MOVE_COUNT; step += 1) {
      const following: number[] = [];
      for (const current of frontier) {
        for (
          let edge = edgeStarts[current]!;
          edge < edgeStarts[current + 1]!;
          edge += 1
        ) {
          const target = edges[edge]!;
          if (!reached.has(target)) {
            reached.add(target);
            marks[target] = 1;
            following.push(target);
          }
        }
      }
      frontier = following;
    }
  };
  const markAncestors = (marks: Uint8Array, origin: number) => {
    const stack = [origin];
    marks[origin] = 1;
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const target = edges[edge]!;
        if (marks[target] === 0 && optimal[target] === optimal[current]! + 1) {
          marks[target] = 1;
          stack.push(target);
        }
      }
    }
  };
  const markDescendants = (owners: Int32Array, origin: number) => {
    const own = optimal[origin]!;
    const stack = [origin];
    owners[origin] = Math.min(owners[origin]!, own);
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const target = edges[edge]!;
        if (
          optimal[target] === optimal[current]! - 1 &&
          owners[target]! > own
        ) {
          owners[target] = own;
          stack.push(target);
        }
      }
    }
  };
  const noOwner = 2 ** 31 - 1;
  const listFinalPositions = (origin: number) => {
    const finals = new Set<number>();
    const seen = new Set([origin]);
    const stack = [origin];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (optimal[current] === 1) {
        const mirror = mirrorIndex[current]!;
        finals.add(mirror >= 0 ? Math.min(current, mirror) : current);
        continue;
      }
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const target = edges[edge]!;
        if (optimal[target] === optimal[current]! - 1 && !seen.has(target)) {
          seen.add(target);
          stack.push(target);
        }
      }
    }
    return [...finals];
  };
  const upperNear = new Uint8Array(count);
  const upperAncestors = new Uint8Array(count);
  const upperDescendants = new Int32Array(count).fill(noOwner);
  const picked: Record<HakoiriMusumeDifficulty, HakoiriMusumePickedProblem[]> =
    {
      "1": [],
      "2": [],
      "3": [],
      "4": [],
      "5": [],
    };
  for (const level of pickingOrder) {
    const rule = hakoiriMusumeLevelSelections[level];
    const candidates: { state: number; tiers: number[]; rank: number }[] = [];
    for (const state of byLevel[level]) {
      const key = graph.keys[state]!;
      if (
        optimal[state]! < rule.optimalMoveCount[0] ||
        optimal[state]! > rule.optimalMoveCount[1] ||
        (emptyCellCount >= TOUCH_SOLVABLE_EMPTY_CELLS &&
          preparation[state] === 0)
      ) {
        reject("rule");
        continue;
      }
      const farFirst = isTargetFar(space, key, 0);
      if (rule.requireFarTarget && !farFirst) {
        reject("rule");
        continue;
      }
      let farAll = farFirst;
      for (let target = 1; target < space.targetCount; target += 1) {
        farAll &&= isTargetFar(space, key, target);
      }
      let targetMovesAtStart = false;
      for (
        let edge = edgeStarts[state]!;
        edge < edgeStarts[state + 1]!;
        edge += 1
      ) {
        targetMovesAtStart ||= movers[edge]! >= 0;
      }
      const singleFirstMove = edgeStarts[state + 1]! - edgeStarts[state]! === 1;
      candidates.push({
        state,
        tiers: [
          farFirst ? 0 : 1,
          farAll ? 0 : 1,
          (targetMovesAtStart ? 1 : 0) + (singleFirstMove ? 1 : 0),
        ],
        rank: hashText(`${seed}:${key}`),
      });
    }
    candidates.sort((left, right) => {
      for (let index = 0; index < left.tiers.length; index += 1) {
        if (left.tiers[index] !== right.tiers[index]) {
          return left.tiers[index]! - right.tiers[index]!;
        }
      }
      return left.rank - right.rank;
    });
    const near = new Uint8Array(count);
    const ancestors = new Uint8Array(count);
    const descendants = new Int32Array(count).fill(noOwner);
    let shortestTaken = noOwner;
    const merges = (origin: number) => {
      if (shortestTaken === noOwner) {
        return false;
      }
      const own = optimal[origin]!;
      const tailMinimum = MERGE_SHARE * Math.min(own, shortestTaken);
      const seen = new Set([origin]);
      const stack = [origin];
      while (stack.length > 0) {
        const current = stack.pop()!;
        const tail = optimal[current]!;
        if (
          descendants[current] !== noOwner &&
          tail >= MERGE_SHARE * Math.min(own, descendants[current]!)
        ) {
          return true;
        }
        for (
          let edge = edgeStarts[current]!;
          edge < edgeStarts[current + 1]!;
          edge += 1
        ) {
          const target = edges[edge]!;
          if (
            optimal[target] === tail - 1 &&
            tail - 1 >= tailMinimum &&
            !seen.has(target)
          ) {
            seen.add(target);
            stack.push(target);
          }
        }
      }
      return false;
    };
    const byComponent = new Map<number, number>();
    const byFinal = new Map<number, number>();
    for (const { state } of candidates) {
      if (picked[level].length >= limit) {
        break;
      }
      if ((byComponent.get(components[state]!) ?? 0) >= rule.componentLimit) {
        reject("component");
        continue;
      }
      if (
        upperNear[state] ||
        upperAncestors[state] ||
        upperDescendants[state] !== noOwner
      ) {
        reject("upper");
        continue;
      }
      if (near[state] || ancestors[state] || merges(state)) {
        reject("near");
        continue;
      }
      const finals =
        rule.finalPositionLimit === null ? [] : listFinalPositions(state);
      if (
        rule.finalPositionLimit !== null &&
        finals.some(
          (final) => (byFinal.get(final) ?? 0) >= rule.finalPositionLimit!,
        )
      ) {
        reject("final");
        continue;
      }
      if (confirmHakoiriMusumeNormalForm(graph, measures, state) === null) {
        reject("normal-form");
        continue;
      }
      const superfluous = hasSuperfluousPiece(
        graph.keys[state]!,
        optimal[state]!,
      );
      if (superfluous === true) {
        reject("superfluous");
        continue;
      }
      if (superfluous === null) {
        reject("superfluous-unknown-taken");
      }
      for (const target of new Set([
        state,
        mirrorIndex[state]! >= 0 ? mirrorIndex[state]! : state,
      ])) {
        markNear(near, target);
        markAncestors(ancestors, target);
        markDescendants(descendants, target);
        shortestTaken = Math.min(shortestTaken, optimal[target]!);
      }
      byComponent.set(
        components[state]!,
        (byComponent.get(components[state]!) ?? 0) + 1,
      );
      for (const final of finals) {
        byFinal.set(final, (byFinal.get(final) ?? 0) + 1);
      }
      picked[level].push({
        key: graph.keys[state]!,
        optimalMoveCount: optimal[state]!,
        preparationLength: preparation[state]!,
        daughterDetourCount: detour[state]!,
        shortestPreparationLength: shortestPreparation[state]!,
      });
    }
    for (const problem of picked[level]) {
      const state = graph.indexByKey.get(problem.key)!;
      for (const target of new Set([
        state,
        mirrorIndex[state]! >= 0 ? mirrorIndex[state]! : state,
      ])) {
        markNear(upperNear, target);
        markAncestors(upperAncestors, target);
        markDescendants(upperDescendants, target);
      }
    }
  }
  return { picked, rejected };
}
