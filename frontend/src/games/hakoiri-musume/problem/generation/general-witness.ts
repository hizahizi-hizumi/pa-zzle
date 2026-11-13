import {
  type HakoiriMusumeGeneralGraph,
  type HakoiriMusumeGeneralMeasures,
  _private as measure,
  readHakoiriMusumePreparationTable,
} from "@/games/hakoiri-musume/problem/generation/general-measure";
import {
  decodeHakoiriMusumeState,
  encodeHakoiriMusumeState,
  findHakoiriMusumeTargetPlacement,
  type HakoiriMusumeMove,
  type HakoiriMusumeSpace,
  type HakoiriMusumeStateKey,
  listHakoiriMusumeMoves,
  measureHakoiriMusumeStateDistance,
} from "@/games/hakoiri-musume/problem/generation/general-space";

/**
 * 解の道（盤面の並び）を数え直し、並べ替える道具。1手の行き先は盤面ごとに覚えておく。
 * 道の盤面は、グラフの外の盤面（目標を置き直した盤面）も含むので、グラフの番号ではなく盤面の文字列で扱う。
 */
type PathTools = {
  space: HakoiriMusumeSpace;
  movesOf: (
    key: HakoiriMusumeStateKey,
  ) => ReadonlyMap<HakoiriMusumeStateKey, HakoiriMusumeMove>;
  distanceOf: (key: HakoiriMusumeStateKey) => number;
};

function createPathTools(space: HakoiriMusumeSpace): PathTools {
  const moves = new Map<
    HakoiriMusumeStateKey,
    Map<HakoiriMusumeStateKey, HakoiriMusumeMove>
  >();
  const distances = new Map<HakoiriMusumeStateKey, number>();
  return {
    space,
    movesOf(key) {
      let found = moves.get(key);
      if (!found) {
        found = new Map(
          listHakoiriMusumeMoves(space, key).map((move) => [move.key, move]),
        );
        moves.set(key, found);
      }
      return found;
    },
    distanceOf(key) {
      let found = distances.get(key);
      if (found === undefined) {
        found = measureHakoiriMusumeStateDistance(space, key);
        distances.set(key, found);
      }
      return found;
    },
  };
}

/** 盤面 `from` から `to` への1手。1手で行けなければ `null`。`peak` は距離の和で数えた値。 */
function findMove(
  tools: PathTools,
  from: HakoiriMusumeStateKey,
  to: HakoiriMusumeStateKey,
) {
  const move = tools.movesOf(from).get(to);
  if (!move) {
    return null;
  }
  return {
    mover: move.mover,
    peak:
      move.mover < 0
        ? -1
        : move.peak +
          tools.distanceOf(from) -
          targetDistance(tools.space, from, move.mover),
  };
}

function targetDistance(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
  target: number,
) {
  return space.types[target]!.distances[
    findHakoiriMusumeTargetPlacement(space, key, target)
  ]!;
}

/**
 * 目標 `target` を置き場所 `placement` へ置き直した盤面。ほかの駒・壁と重なるなら `null`。
 */
function relocateTarget(
  space: HakoiriMusumeSpace,
  key: HakoiriMusumeStateKey,
  target: number,
  placement: number,
): HakoiriMusumeStateKey | null {
  const pieces = decodeHakoiriMusumeState(space, key);
  let occupied = space.wallMask;
  for (const piece of pieces) {
    if (piece.type !== target) {
      occupied |= space.types[piece.type]!.masks[piece.placement]!;
    }
  }
  if ((space.types[target]!.masks[placement]! & occupied) !== 0) {
    return null;
  }
  return encodeHakoiriMusumeState(
    space,
    pieces.map((piece) =>
      piece.type === target ? { type: target, placement } : piece,
    ),
  );
}

/** 解の道の上で数えた値。`simple` は同じ盤面を2度通らないか、`separate` は同じ目標の手が続かないか。 */
export type HakoiriMusumePathMeasure = {
  preparation: number;
  detour: number;
  simple: boolean;
  separate: boolean;
};

/** 道の各手の、動かした目標と距離の和で数えた滑りの最大。 */
function readMoves(tools: PathTools, boards: readonly HakoiriMusumeStateKey[]) {
  return boards
    .slice(1)
    .map((board, index) => findMove(tools, boards[index]!, board)!);
}

/** 道の上の前進の位置（何手目か）。 */
function listAdvances(
  tools: PathTools,
  boards: readonly HakoiriMusumeStateKey[],
): number[] {
  const moves = readMoves(tools, boards);
  const length = moves.length;
  const later = new Array<number>(length + 1).fill(-1);
  for (let index = length - 1; index >= 0; index -= 1) {
    const move = moves[index]!;
    later[index] = Math.max(
      later[index + 1]!,
      tools.distanceOf(boards[index + 1]!),
      move.mover >= 0 ? move.peak : -1,
    );
  }
  let base = tools.distanceOf(boards[0]!);
  const advances: number[] = [];
  for (let step = 1; step <= length; step += 1) {
    if (moves[step - 1]!.mover < 0) {
      continue;
    }
    const here = tools.distanceOf(boards[step]!);
    const before = tools.distanceOf(boards[step - 1]!);
    if (here < before && here < base && later[step]! <= here) {
      advances.push(step);
      base = here;
    }
  }
  return advances;
}

/** `HakoiriMusumeGeneralMeasures` と同じ定義を、その道だけで数える。 */
export function measureHakoiriMusumeGeneralPath(
  space: HakoiriMusumeSpace,
  boards: readonly HakoiriMusumeStateKey[],
): HakoiriMusumePathMeasure {
  return measurePath(createPathTools(space), boards);
}

function measurePath(
  tools: PathTools,
  boards: readonly HakoiriMusumeStateKey[],
): HakoiriMusumePathMeasure {
  const moves = readMoves(tools, boards);
  const length = moves.length;
  let detour = 0;
  for (let step = 1; step <= length; step += 1) {
    if (
      moves[step - 1]!.mover >= 0 &&
      tools.distanceOf(boards[step]!) > tools.distanceOf(boards[step - 1]!)
    ) {
      detour += 1;
    }
  }
  let preparation = 0;
  let previous = 0;
  for (const step of listAdvances(tools, boards)) {
    preparation = Math.max(preparation, step - previous - 1);
    previous = step;
  }
  preparation = Math.max(preparation, length - previous);
  return {
    preparation,
    detour,
    simple: new Set(boards).size === boards.length,
    separate: moves.every(
      (move, index) =>
        index === 0 || move.mover < 0 || move.mover !== moves[index - 1]!.mover,
    ),
  };
}

/**
 * 目標の手・（目標の手と入れ替えられるほかの駒の手）・同じ目標の手、の並びのうち、2つの目標の手を1手にまとめられる最初の並びを
 * まとめた道。まとめられる並びが無ければ `null`。前へまとめる（目標を1つ目の手の前の位置に置いたまま、あいだの手を指してから
 * 1手で2つ目の手の後へ）か、後ろへまとめる（1手で2つ目の手の後の位置へ行ってから、あいだの手を指す）。同じ盤面が続けば1つにする。
 */
function mergeFirstTargetMoves(
  tools: PathTools,
  boards: readonly HakoiriMusumeStateKey[],
): HakoiriMusumeStateKey[] | null {
  const { space } = tools;
  for (let target = 0; target < space.targetCount; target += 1) {
    const placementCount = space.types[target]!.masks.length;
    let before = -1;
    let kept: boolean[] = [];
    for (let index = 1; index < boards.length; index += 1) {
      const from = boards[index - 1]!;
      const to = boards[index]!;
      const move = findMove(tools, from, to)!;
      if (move.mover === target) {
        if (before >= 0) {
          const start = before;
          const startBoard = boards[start]!;
          const origin = findHakoiriMusumeTargetPlacement(
            space,
            startBoard,
            target,
          );
          const goal = findHakoiriMusumeTargetPlacement(space, to, target);
          let merged: HakoiriMusumeStateKey[] | null = null;
          if (kept[origin]) {
            const returned = relocateTarget(space, from, target, origin);
            if (
              returned !== null &&
              (returned === to || findMove(tools, returned, to))
            ) {
              const relocated = boards
                .slice(start + 2, index)
                .map((board) => relocateTarget(space, board, target, origin));
              if (relocated.every((board) => board !== null)) {
                merged = [
                  startBoard,
                  ...(relocated as HakoiriMusumeStateKey[]),
                  to,
                ];
              }
            }
          }
          if (merged === null && kept[goal]) {
            const slid = relocateTarget(space, startBoard, target, goal);
            if (
              slid !== null &&
              (slid === startBoard || findMove(tools, startBoard, slid))
            ) {
              const relocated = boards
                .slice(start + 1, index)
                .map((board) => relocateTarget(space, board, target, goal));
              if (relocated.every((board) => board !== null)) {
                merged = [
                  startBoard,
                  ...(relocated as HakoiriMusumeStateKey[]),
                  to,
                ];
              }
            }
          }
          if (merged !== null) {
            const joined = [
              ...boards.slice(0, start),
              ...merged,
              ...boards.slice(index + 1),
            ];
            return joined.filter(
              (board, position) => board !== joined[position - 1],
            );
          }
        }
        before = index - 1;
        kept = Array.from(
          { length: placementCount },
          (_, placement) =>
            relocateTarget(space, to, target, placement) !== null,
        );
        continue;
      }
      if (before < 0) {
        continue;
      }
      let anyKept = false;
      kept = kept.map((isKept, placement) => {
        if (!isKept) {
          return false;
        }
        const relocatedFrom = relocateTarget(space, from, target, placement);
        const relocatedTo = relocateTarget(space, to, target, placement);
        const stays =
          relocatedFrom !== null &&
          relocatedTo !== null &&
          findMove(tools, relocatedFrom, relocatedTo) !== null;
        anyKept ||= stays;
        return stays;
      });
      if (!anyKept) {
        before = -1;
      }
    }
  }
  return null;
}

function mergeTargetMoves(
  tools: PathTools,
  boards: readonly HakoiriMusumeStateKey[],
) {
  let current = [...boards];
  for (let guard = 0; guard < 1000; guard += 1) {
    const merged = mergeFirstTargetMoves(tools, current);
    if (merged === null) {
      break;
    }
    current = merged;
  }
  return current;
}

/**
 * 前進をできるだけ早くした道。前進の直前の手がほかの駒の手で、前進と入れ替えても指せるなら入れ替え、入れ替えられなくなるまで続ける。
 * 入れ替えるたびに、まとめられる目標の手をまとめ、同じ目標の手が続けば1手にする。
 */
function advanceEarly(
  tools: PathTools,
  boards: readonly HakoiriMusumeStateKey[],
) {
  const { space } = tools;
  let current = [...boards];
  for (let iteration = 0; iteration < 400; iteration += 1) {
    const advances = listAdvances(tools, current);
    const advanceSet = new Set(advances);
    let changed = false;
    for (const step of advances) {
      if (step < 2 || advanceSet.has(step - 1)) {
        continue;
      }
      const mover = findMove(tools, current[step - 1]!, current[step]!)!.mover;
      const previousMover = findMove(
        tools,
        current[step - 2]!,
        current[step - 1]!,
      )!.mover;
      if (previousMover === mover) {
        continue;
      }
      const placement = findHakoiriMusumeTargetPlacement(
        space,
        current[step]!,
        mover,
      );
      const earlier = relocateTarget(
        space,
        current[step - 2]!,
        mover,
        placement,
      );
      if (
        earlier === null ||
        !findMove(tools, current[step - 2]!, earlier) ||
        !findMove(tools, earlier, current[step]!) ||
        current.includes(earlier)
      ) {
        continue;
      }
      current[step - 1] = earlier;
      changed = true;
      break;
    }
    if (!changed) {
      break;
    }
    current = mergeTargetMoves(tools, current);
    for (let index = 2; index < current.length; index += 1) {
      const first = findMove(
        tools,
        current[index - 2]!,
        current[index - 1]!,
      )!.mover;
      const second = findMove(
        tools,
        current[index - 1]!,
        current[index]!,
      )!.mover;
      if (
        first >= 0 &&
        first === second &&
        findMove(tools, current[index - 2]!, current[index]!)
      ) {
        current.splice(index - 1, 1);
        index = 1;
      }
    }
  }
  return current;
}

export function normalizeHakoiriMusumeGeneralPath(
  space: HakoiriMusumeSpace,
  boards: readonly HakoiriMusumeStateKey[],
): HakoiriMusumeStateKey[] {
  const tools = createPathTools(space);
  return advanceEarly(tools, mergeTargetMoves(tools, boards));
}

/**
 * 盤面ごとにずらす量。盤面の文字列から決め、全局面のグラフでも連結成分のグラフでも、同じ盤面では同じ順に辺を見る。
 */
function rotationOf(key: HakoiriMusumeStateKey): number {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 1_000_003;
  }
  return hash;
}

/** 辺を見る順。0 は並びのまま、1 は逆、2 は盤面ごとにずらした飛び飛びの順。 */
function edgeAt(
  start: number,
  end: number,
  offset: number,
  rotation: number,
  order: number,
) {
  const size = end - start;
  if (order === 0) {
    return start + offset;
  }
  if (order === 1) {
    return end - 1 - offset;
  }
  return size % 7 !== 0
    ? start + ((offset * 7 + rotation) % size)
    : start + ((offset + rotation) % size);
}

/**
 * 準備の長さ `preparation` と遠回り `detour` を与える、同じ盤面を2度通らない解（証人）。区間ごとに、表の値をたどって
 * 前進（またはゴール）までの手を幅優先で探す。見つからなければ `null`。
 */
export function findHakoiriMusumeGeneralWitness(
  graph: HakoiriMusumeGeneralGraph,
  measures: HakoiriMusumeGeneralMeasures,
  start: number,
  order: number,
): number[] | null {
  const { edgeStarts, edges, movers, peaks, distance } = graph;
  const { optimal, trace } = measures;
  const preparation = measures.preparation[start]!;
  const unlimitedSlot = trace.slotCount - 1;
  const keyOf = (state: number, flag: number, slot: number) =>
    (state * trace.flagCount + flag) * trace.slotCount + slot;
  const rotations: number[] = [];
  const path = [start];
  const onPath = new Set(path);
  let current = start;
  let code = distance[start]!;
  let slot = Math.min(measures.detour[start]!, unlimitedSlot);
  let flag = 0;
  while (optimal[current] !== 0) {
    const limit = measure.limitOf(trace.codes, code);
    const threshold = measure.thresholdOf(trace.codes, code);
    const startKey = keyOf(current, flag, slot);
    const parents = new Map<number, number>([[startKey, -1]]);
    let frontier = [{ state: current, flag, slot, steps: 0, key: startKey }];
    let segment: number[] | null = null;
    let next = { code, slot, flag };
    const toBoards = (key: number, last: number) => {
      const boards = [last];
      for (let at = key; at !== startKey; at = parents.get(at)!) {
        boards.push(Math.floor(at / trace.slotCount / trace.flagCount));
      }
      return boards.reverse();
    };
    while (frontier.length > 0 && segment === null) {
      const following: typeof frontier = [];
      for (const node of frontier) {
        const first = edgeStarts[node.state]!;
        const end = edgeStarts[node.state + 1]!;
        for (
          let offset = 0;
          offset < end - first && segment === null;
          offset += 1
        ) {
          const edge = edgeAt(
            first,
            end,
            offset,
            (rotations[node.state] ??= rotationOf(graph.keys[node.state]!)),
            order,
          );
          const target = edges[edge]!;
          const mover = movers[edge]!;
          if (
            (mover >= 0 && peaks[edge]! > limit) ||
            onPath.has(target) ||
            (mover >= 0 && node.flag === mover + 1)
          ) {
            continue;
          }
          let targetSlot = node.slot;
          if (
            node.slot !== unlimitedSlot &&
            mover >= 0 &&
            distance[target]! > distance[node.state]!
          ) {
            targetSlot -= 1;
          }
          if (targetSlot < 0) {
            continue;
          }
          if (
            mover >= 0 &&
            distance[target]! < threshold &&
            distance[target]! < distance[node.state]!
          ) {
            const advancedCode = measure.advancedCodeOf(
              trace.codes,
              distance[target]!,
            );
            const value =
              optimal[target] === 0
                ? 0
                : readHakoiriMusumePreparationTable(
                    trace,
                    target,
                    mover + 1,
                    targetSlot,
                  );
            if (value <= preparation) {
              segment = toBoards(node.key, target);
              next = { code: advancedCode, slot: targetSlot, flag: mover + 1 };
              break;
            }
          }
          if (optimal[target] === 0 && node.steps + 1 <= preparation) {
            segment = toBoards(node.key, target);
            next = { code, slot: targetSlot, flag: mover + 1 };
            break;
          }
          const targetFlag = mover >= 0 ? mover + 1 : 0;
          const targetKey = keyOf(target, targetFlag, targetSlot);
          if (
            node.steps + 1 <= preparation &&
            optimal[target]! > 0 &&
            distance[target]! <= limit &&
            !parents.has(targetKey)
          ) {
            parents.set(targetKey, node.key);
            following.push({
              state: target,
              flag: targetFlag,
              slot: targetSlot,
              steps: node.steps + 1,
              key: targetKey,
            });
          }
        }
        if (segment !== null) {
          break;
        }
      }
      frontier = following;
    }
    if (segment === null) {
      return null;
    }
    for (const board of segment) {
      if (onPath.has(board)) {
        return null;
      }
      onPath.add(board);
      path.push(board);
    }
    current = path.at(-1)!;
    ({ code, slot, flag } = next);
    if (path.length > 2000) {
      return null;
    }
  }
  return path;
}

/**
 * 準備の長さと遠回りが、正規形の解で確かめられるか。正規形の解は、同じ盤面を2度通らず、同じ目標の手が続かず、入れ替えで1手に
 * まとまる目標の手が無く、前進ができるだけ早い解。証人を辺の3通りの順で探し、どれか1つで、証人・まとめた道・前進を早めた道の
 * どれの上で数え直しても同じ値になれば確かめられたとする。
 */
export function confirmHakoiriMusumeNormalForm(
  graph: HakoiriMusumeGeneralGraph,
  measures: HakoiriMusumeGeneralMeasures,
  start: number,
): HakoiriMusumeStateKey[] | null {
  const tools = createPathTools(graph.space);
  const expectedDetour = Math.min(measures.detour[start]!, 3);
  const matches = (measured: HakoiriMusumePathMeasure) =>
    measured.preparation === measures.preparation[start] &&
    Math.min(measured.detour, 3) === expectedDetour;
  for (let order = 0; order < 3; order += 1) {
    const witness = findHakoiriMusumeGeneralWitness(
      graph,
      measures,
      start,
      order,
    );
    if (witness === null) {
      continue;
    }
    const boards = witness.map((state) => graph.keys[state]!);
    const measured = measurePath(tools, boards);
    if (!matches(measured) || !measured.simple || !measured.separate) {
      continue;
    }
    const merged = mergeTargetMoves(tools, boards);
    if (!matches(measurePath(tools, merged))) {
      continue;
    }
    const early = advanceEarly(tools, merged);
    if (matches(measurePath(tools, early))) {
      return early;
    }
  }
  return null;
}
