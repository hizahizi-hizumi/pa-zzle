import { HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT } from "@/games/hakoiri-musume/problem/daughter-detour";
import {
  type HakoiriMusumeSpace,
  type HakoiriMusumeStateKey,
  isHakoiriMusumeGoalState,
  listHakoiriMusumeMoves,
  measureHakoiriMusumeStateDistance,
} from "@/games/hakoiri-musume/problem/generation/general-space";

/**
 * 盤面の集まりと1手の辺。辺は `edgeStarts[i]` から `edgeStarts[i + 1]` の手前まで。
 * - `movers`: 辺ごとの、動かした目標の番号（目標でない駒は -1）。
 * - `peaks`: 辺ごとの、目標の手の1手の中で通る位置の、目標の距離の和の最大（目標でない駒は -1）。
 */
export type HakoiriMusumeGeneralGraph = {
  space: HakoiriMusumeSpace;
  keys: readonly HakoiriMusumeStateKey[];
  indexByKey: ReadonlyMap<HakoiriMusumeStateKey, number>;
  edgeStarts: Int32Array;
  edges: Int32Array;
  movers: Int8Array;
  peaks: Int16Array;
  /** 盤面ごとの目標の距離の和。 */
  distance: Int16Array;
};

/**
 * `seeds` から1手ずつたどれる盤面の全部と辺。盤面が `cap` を超えたら `null`（大きすぎて扱わない）。
 * 起点を目標がどれも行き先にある盤面の全部にすると、駒の組の解ける盤面の全部になる。
 */
export function createHakoiriMusumeGeneralGraph(
  space: HakoiriMusumeSpace,
  seeds: readonly HakoiriMusumeStateKey[],
  cap = Number.POSITIVE_INFINITY,
): HakoiriMusumeGeneralGraph | null {
  const keys = [...seeds];
  const indexByKey = new Map(keys.map((key, index) => [key, index]));
  const edgeStarts: number[] = [];
  const edges: number[] = [];
  const movers: number[] = [];
  const peaks: number[] = [];
  const distance: number[] = [];
  for (let current = 0; current < keys.length; current += 1) {
    edgeStarts.push(edges.length);
    const key = keys[current]!;
    const ownDistance = measureHakoiriMusumeStateDistance(space, key);
    distance.push(ownDistance);
    for (const move of listHakoiriMusumeMoves(space, key)) {
      let next = indexByKey.get(move.key);
      if (next === undefined) {
        next = keys.length;
        indexByKey.set(move.key, next);
        keys.push(move.key);
      }
      edges.push(next);
      movers.push(move.mover);
      peaks.push(
        move.mover < 0
          ? -1
          : move.peak + ownDistance - targetDistanceOf(space, key, move.mover),
      );
    }
    if (keys.length > cap) {
      return null;
    }
  }
  edgeStarts.push(edges.length);
  return {
    space,
    keys,
    indexByKey,
    edgeStarts: Int32Array.from(edgeStarts),
    edges: Int32Array.from(edges),
    movers: Int8Array.from(movers),
    peaks: Int16Array.from(peaks),
    distance: Int16Array.from(distance),
  };
}

function targetDistanceOf(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
  target: number,
): number {
  const type = space.types[target]!;
  const cell = key.indexOf(String.fromCharCode(49 + target));
  return type.distances[type.placementAtFirst[cell]!]!;
}

/**
 * - `optimal`: 運べなければ -1。
 * - `preparation`: 前進の基準の距離は、始めは始めの盤面の距離。始め〜最初の前進と、最後の前進〜ゴールも区間に数える。
 *   100 を超えたら 101 にまとめる。
 * - `detour`: `HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT` を超える回数はその1つ上にまとめる。
 * - `lure`・`daughterMoves`・`optimalFirstMoves`・`firstMoves`: 最短解の上で値が最も少ない解で数える。分類には使わず、記録だけする。
 */
export type HakoiriMusumeGeneralMeasures = {
  optimal: Int32Array;
  preparation: Uint8Array;
  detour: Uint8Array;
  shortestPreparation: Uint8Array;
  lure: Int32Array;
  daughterMoves: Int32Array;
  optimalFirstMoves: Int32Array;
  firstMoves: Int32Array;
  trace: HakoiriMusumePreparationTable;
};

/** 準備の長さが数えきれない（100 を超えた）とき、または運べないときの値。 */
export const PREPARATION_CAP = 101;
const UNKNOWN = 255;

/** ゴールからの多始点の幅優先探索。 */
export function measureHakoiriMusumeOptimal(
  graph: HakoiriMusumeGeneralGraph,
): Int32Array {
  const count = graph.keys.length;
  const optimal = new Int32Array(count).fill(-1);
  const queue: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (isHakoiriMusumeGoalState(graph.space, graph.keys[index]!)) {
      optimal[index] = 0;
      queue.push(index);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    for (
      let edge = graph.edgeStarts[current]!;
      edge < graph.edgeStarts[current + 1]!;
      edge += 1
    ) {
      const next = graph.edges[edge]!;
      if (optimal[next] === -1) {
        optimal[next] = optimal[current]! + 1;
        queue.push(next);
      }
    }
  }
  return optimal;
}

/**
 * 区間の型。区間は距離の和の上限 `limit` と、前進と認める距離のしきい値 `threshold` で決まる。
 * 型の番号 `code` は、`code ≤ M`（M は距離の和の最大）なら始めの区間（しきい値 `code`、上限 M）、`code > M` なら距離
 * `code - M - 1` へ前進した後の区間（上限としきい値が `code - M - 1`）。
 */
type SegmentCodes = { maxDistance: number };

const limitOf = ({ maxDistance }: SegmentCodes, code: number) =>
  code <= maxDistance ? maxDistance : code - maxDistance - 1;
const thresholdOf = ({ maxDistance }: SegmentCodes, code: number) =>
  code <= maxDistance ? code : code - maxDistance - 1;
const isAdvancedCode = ({ maxDistance }: SegmentCodes, code: number) =>
  code > maxDistance;
const advancedCodeOf = ({ maxDistance }: SegmentCodes, distance: number) =>
  maxDistance + 1 + distance;
const rankOf = ({ maxDistance }: SegmentCodes, code: number) =>
  code <= maxDistance ? 2 * code + 1 : 2 * (code - maxDistance - 1);

/**
 * 準備の長さを与える解をたどり直すための表。前進した直後の盤面（その距離の区間の始め）から出口までの準備の長さを、盤面・直前の手の
 * 目標（0 は目標でない駒、`t + 1` は目標 `t`）・遠回りの残りの枠ごとに持つ。前進した直後の区間はその盤面の距離で決まるので、盤面ごとに
 * 1つの区間の値だけを持つ。枠は 0〜`maximumCountedDetour` が遠回りの残りの回数で、最後の枠は遠回りを縛らない。
 */
export type HakoiriMusumePreparationTable = {
  flagCount: number;
  slotCount: number;
  codes: SegmentCodes;
  afterAdvance: Uint8Array;
};

/** 盤面 `state` へ前進した直後の区間の値。前進した直後の盤面として求めていなければ `UNKNOWN`。 */
export function readHakoiriMusumePreparationTable(
  table: HakoiriMusumePreparationTable,
  state: number,
  flag: number,
  slot: number,
): number {
  return table.afterAdvance[
    (state * table.flagCount + flag) * table.slotCount + slot
  ]!;
}

/**
 * 準備の長さと遠回り。区間の始めの値は、前進できる盤面までの手の数と、前進した先の区間の値の大きい方の最小。値が `T` 以下に
 * なるのは値が `T` 以下の前進へ `T` 手以内で行けるときなので、`T` を 0 から1つずつ上げ、起点を足しながら、起点からの手の数を
 * 幅優先で更新していく。ゴールの盤面も区間の終わりとして起点にする（目標が2つのとき、最後の手が前進にならないことがあるため）。
 * 区間の型は、前進した距離の小さい順に求める。
 */
function measurePreparationTable(
  graph: HakoiriMusumeGeneralGraph,
  optimal: Int32Array,
  maximumCountedDetour: number,
  shortestOnly: boolean,
): {
  preparation: Uint8Array;
  detour: Uint8Array;
  table: HakoiriMusumePreparationTable;
} {
  const { space, edgeStarts, edges, movers, peaks, distance } = graph;
  const count = graph.keys.length;
  const flagCount = space.targetCount + 1;
  const slotCount = maximumCountedDetour + 2;
  const unlimitedSlot = slotCount - 1;
  const codes = { maxDistance: space.maxDistance };
  const codeCount = 2 * codes.maxDistance + 1;
  const keyOf = (state: number, flag: number, slot: number) =>
    (state * flagCount + flag) * slotCount + slot;
  const afterAdvance = new Uint8Array(count * flagCount * slotCount).fill(
    UNKNOWN,
  );
  const table = { flagCount, slotCount, codes, afterAdvance };
  const preparation = new Uint8Array(count).fill(UNKNOWN);
  const detour = new Uint8Array(count).fill(UNKNOWN);
  const steps = new Uint16Array(count * flagCount * slotCount).fill(65535);
  const values = new Uint8Array(count * flagCount * slotCount).fill(UNKNOWN);
  const goals: number[] = [];
  for (let state = 0; state < count; state += 1) {
    if (optimal[state] === 0) {
      goals.push(state);
    }
  }
  const order = Array.from({ length: codeCount }, (_, code) => code).sort(
    (left, right) => rankOf(codes, left) - rankOf(codes, right),
  );
  const bestByTarget = new Int32Array(space.targetCount * slotCount);
  const insideFlags = new Uint8Array(count);
  const unresolved = new Uint8Array(count * flagCount * slotCount);
  for (const code of order) {
    const limit = limitOf(codes, code);
    const threshold = thresholdOf(codes, code);
    const advanced = isAdvancedCode(codes, code);
    insideFlags.fill(0);
    const starts: number[] = [];
    const insideStates: number[] = [];
    for (let state = 0; state < count; state += 1) {
      if (optimal[state]! <= 0 || distance[state]! > limit) {
        continue;
      }
      insideFlags[state] = 1;
      insideStates.push(state);
      if (distance[state] === (advanced ? limit : threshold)) {
        starts.push(state);
      }
    }
    if (starts.length === 0) {
      continue;
    }
    const sourcesByValue: number[][] = [];
    const addSource = (key: number, value: number) => {
      const capped = Math.min(value, PREPARATION_CAP);
      (sourcesByValue[capped] ??= []).push(key);
    };
    for (const state of goals) {
      for (let flag = 0; flag < flagCount; flag += 1) {
        for (let slot = 0; slot < slotCount; slot += 1) {
          addSource(keyOf(state, flag, slot), 0);
        }
      }
    }
    for (const state of insideStates) {
      bestByTarget.fill(UNKNOWN);
      let any = false;
      for (
        let edge = edgeStarts[state]!;
        edge < edgeStarts[state + 1]!;
        edge += 1
      ) {
        const mover = movers[edge]!;
        if (mover < 0) {
          continue;
        }
        const next = edges[edge]!;
        if (
          !(
            distance[next]! < threshold &&
            distance[next]! < distance[state]! &&
            peaks[edge]! <= limit
          ) ||
          (shortestOnly && optimal[next] !== optimal[state]! - 1)
        ) {
          continue;
        }
        for (let slot = 0; slot < slotCount; slot += 1) {
          const value =
            optimal[next] === 0
              ? 0
              : afterAdvance[keyOf(next, mover + 1, slot)]!;
          const index = mover * slotCount + slot;
          if (value < bestByTarget[index]!) {
            bestByTarget[index] = value;
            any = true;
          }
        }
      }
      if (!any) {
        continue;
      }
      for (let flag = 0; flag < flagCount; flag += 1) {
        for (let slot = 0; slot < slotCount; slot += 1) {
          let value = UNKNOWN;
          for (let target = 0; target < space.targetCount; target += 1) {
            if (flag !== target + 1) {
              value = Math.min(value, bestByTarget[target * slotCount + slot]!);
            }
          }
          if (value < UNKNOWN) {
            addSource(keyOf(state, flag, slot), value);
          }
        }
      }
    }
    // 値を求める区間の始めの組。手の数がしきい値 `bound` 以下になったときに、そのしきい値を値にする。
    const pending: number[] = [];
    for (const state of starts) {
      for (let flag = 0; flag < flagCount; flag += 1) {
        if (!advanced && flag !== 0) {
          continue;
        }
        for (let slot = 0; slot < slotCount; slot += 1) {
          const key = keyOf(state, flag, slot);
          pending.push(key);
          unresolved[key] = 1;
        }
      }
    }
    let unresolvedCount = pending.length;
    // 手の数が決まった組を、その手の数のしきい値で決まるように並べておく（しきい値ごとに組を全部見直さないため）。
    const resolveAt: number[][] = [];
    const resolve = (key: number, bound: number) => {
      values[key] = Math.min(bound, PREPARATION_CAP);
      unresolved[key] = 0;
      unresolvedCount -= 1;
    };
    const record = (key: number, value: number, bound: number) => {
      if (unresolved[key] === 0) {
        return;
      }
      if (value <= bound) {
        resolve(key, bound);
      } else {
        (resolveAt[value] ??= []).push(key);
      }
    };
    for (
      let bound = 0;
      unresolvedCount > 0 && bound < sourcesByValue.length;
      bound += 1
    ) {
      const queue: number[] = [];
      for (const key of sourcesByValue[bound] ?? []) {
        if (steps[key] !== 0) {
          steps[key] = 0;
          queue.push(key);
          record(key, 0, bound);
        }
      }
      for (let head = 0; head < queue.length; head += 1) {
        const key = queue[head]!;
        const slot = key % slotCount;
        const pair = (key - slot) / slotCount;
        const flag = pair % flagCount;
        const current = (pair - flag) / flagCount;
        const nextSteps = steps[key]! + 1;
        if (nextSteps > PREPARATION_CAP + 1) {
          continue;
        }
        for (
          let edge = edgeStarts[current]!;
          edge < edgeStarts[current + 1]!;
          edge += 1
        ) {
          const mover = movers[edge]!;
          if (!((flag === 0 && mover < 0) || flag === mover + 1)) {
            continue;
          }
          const previous = edges[edge]!;
          if (
            insideFlags[previous] === 0 ||
            (mover >= 0 && peaks[edge]! > limit) ||
            (shortestOnly && optimal[current] !== optimal[previous]! - 1)
          ) {
            continue;
          }
          let previousSlot = slot;
          if (slot !== unlimitedSlot) {
            previousSlot +=
              mover >= 0 && distance[current]! > distance[previous]! ? 1 : 0;
            if (previousSlot > maximumCountedDetour) {
              continue;
            }
          }
          const base = previous * flagCount * slotCount + previousSlot;
          for (
            let previousFlag = 0;
            previousFlag < flagCount;
            previousFlag += 1
          ) {
            if (mover >= 0 && previousFlag === mover + 1) {
              continue;
            }
            const previousKey = base + previousFlag * slotCount;
            if (nextSteps < steps[previousKey]!) {
              steps[previousKey] = nextSteps;
              queue.push(previousKey);
              record(previousKey, nextSteps, bound);
            }
          }
        }
      }
      for (const key of resolveAt[bound] ?? []) {
        if (unresolved[key] === 1 && steps[key]! <= bound) {
          resolve(key, bound);
        }
      }
      if (bound === PREPARATION_CAP) {
        for (const key of pending) {
          if (unresolved[key] === 1 && steps[key] !== 65535) {
            resolve(key, bound);
          }
        }
      }
    }
    // 起点を足し終えた後は手の数が減らないので、残った組の値は前進までの手の数（前進できなければ値を持たない）。
    for (const key of pending) {
      if (unresolved[key] === 1) {
        unresolved[key] = 0;
        if (steps[key] !== 65535) {
          values[key] = Math.min(steps[key]!, PREPARATION_CAP);
        }
      }
    }
    for (const state of [...insideStates, ...goals]) {
      steps.fill(65535, keyOf(state, 0, 0), keyOf(state + 1, 0, 0));
    }
    if (advanced) {
      for (const state of starts) {
        afterAdvance.set(
          values.subarray(keyOf(state, 0, 0), keyOf(state + 1, 0, 0)),
          keyOf(state, 0, 0),
        );
      }
    } else {
      for (const state of starts) {
        const unlimited = values[keyOf(state, 0, unlimitedSlot)]!;
        preparation[state] = unlimited;
        let slot = 0;
        while (
          slot < unlimitedSlot &&
          values[keyOf(state, 0, slot)] !== unlimited
        ) {
          slot += 1;
        }
        detour[state] = unlimited === UNKNOWN ? UNKNOWN : slot;
      }
    }
    for (const state of starts) {
      values.fill(UNKNOWN, keyOf(state, 0, 0), keyOf(state + 1, 0, 0));
    }
  }
  for (const state of goals) {
    preparation[state] = 0;
    detour[state] = 0;
  }
  return { preparation, detour, table };
}

export function measureHakoiriMusumeGeneralGraph(
  graph: HakoiriMusumeGeneralGraph,
): HakoiriMusumeGeneralMeasures {
  const { edgeStarts, edges, movers, distance } = graph;
  const count = graph.keys.length;
  const optimal = measureHakoiriMusumeOptimal(graph);
  const full = measurePreparationTable(
    graph,
    optimal,
    HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT,
    false,
  );
  const shortest = measurePreparationTable(graph, optimal, -1, true);
  const lure = new Int32Array(count);
  const daughterMoves = new Int32Array(count);
  const optimalFirstMoves = new Int32Array(count);
  const firstMoves = new Int32Array(count);
  const order = Array.from({ length: count }, (_, index) => index)
    .filter((index) => optimal[index]! >= 0)
    .sort((left, right) => optimal[left]! - optimal[right]!);
  for (const current of order) {
    firstMoves[current] = edgeStarts[current + 1]! - edgeStarts[current]!;
    const remaining = optimal[current]!;
    if (remaining === 0) {
      continue;
    }
    let tempted = false;
    for (
      let edge = edgeStarts[current]!;
      edge < edgeStarts[current + 1]!;
      edge += 1
    ) {
      const next = edges[edge]!;
      if (distance[next]! < distance[current]! && optimal[next]! >= remaining) {
        tempted = true;
      }
    }
    let bestLure = Number.POSITIVE_INFINITY;
    let bestDaughterMoves = Number.POSITIVE_INFINITY;
    let optimalFirst = 0;
    for (
      let edge = edgeStarts[current]!;
      edge < edgeStarts[current + 1]!;
      edge += 1
    ) {
      const next = edges[edge]!;
      if (optimal[next] !== remaining - 1) {
        continue;
      }
      optimalFirst += 1;
      bestLure = Math.min(bestLure, (tempted ? 1 : 0) + lure[next]!);
      bestDaughterMoves = Math.min(
        bestDaughterMoves,
        (movers[edge]! >= 0 ? 1 : 0) + daughterMoves[next]!,
      );
    }
    lure[current] = bestLure;
    daughterMoves[current] = bestDaughterMoves;
    optimalFirstMoves[current] = optimalFirst;
  }
  return {
    optimal,
    preparation: full.preparation,
    detour: full.detour,
    shortestPreparation: shortest.preparation,
    lure,
    daughterMoves,
    optimalFirstMoves,
    firstMoves,
    trace: full.table,
  };
}

export const _private = { advancedCodeOf, limitOf, thresholdOf, UNKNOWN };
