import {
  findHakoiriMusumeDaughterCell,
  type HakoiriMusumeBoardText,
  type HakoiriMusumeStateGraph,
  type HakoiriMusumeStateMeasures,
  listHakoiriMusumeNextBoards,
  measureHakoiriMusumeDaughterDistance,
  toPreparationStateKey,
} from "@/games/hakoiri-musume/problem/generation/state-space";
import {
  getHakoiriMusumeCellPosition,
  HAKOIRI_MUSUME_CELL_COUNT,
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
} from "@/games/hakoiri-musume/puzzle/board";

/** 準備の長さを与える解を探すときの、始めの区間の娘の距離の上限（娘が盤面のどこにいても 4 以下）。 */
const FIRST_SEGMENT_LIMIT = 4;

/** 区間の中の探索の状態。`afterDaughterMove` は直前の手が娘の手か（娘の手を続けて2つ使わない）。 */
type SegmentState = {
  board: number;
  afterDaughterMove: boolean;
  slot: number;
  steps: number;
};

/**
 * 盤面 `start` から、準備の長さ `preparation` と娘の遠回り `detour` を与える解のうち、同じ盤面を2度通らない解を1つ探す。
 * 見つからなければ `null`。
 *
 * 準備の長さは全局面の上の最小で求めるので、同じ盤面へ戻る輪を含む解でしか出ない値になることがある（娘を一度上げて戻すと、
 * 前進の位置が後ろへずれる）。問題集には、同じ盤面を2度通らない解でもその値になる問題だけを採る。
 * 区間ごとに、前進できる盤面までを手の少ない順にたどり、既に通った盤面を避けて、前進した先の区間の値が準備の長さ以下になる前進を
 * 選ぶ。選び方は1通りに決めて戻らないので、見つからなくても輪の無い解が無いとは限らない。そのときは採らない側に倒す。
 * 娘を続けて動かすのは同じ1手なので、解の上で娘の手を続けて2つ使わない。
 */
export function findHakoiriMusumeSimplePreparationPath(
  graph: HakoiriMusumeStateGraph,
  measures: HakoiriMusumeStateMeasures,
  start: number,
  preparation: number,
  detour: number,
): number[] | null {
  const { edgeStarts, edges } = graph;
  const { optimal } = measures;
  const { distance, slidePeaks, afterAdvance, detourSlotCount } =
    measures.preparationTrace;
  const unlimitedSlot = detourSlotCount - 1;
  const path = [start];
  const onPath = new Set(path);
  let current = start;
  let limit = FIRST_SEGMENT_LIMIT;
  let threshold = distance[start]!;
  let slot = Math.min(detour, unlimitedSlot);
  let afterDaughterMove = false;
  const keyOf = (board: number, daughterMoved: boolean, detourSlot: number) =>
    toPreparationStateKey(board, daughterMoved, detourSlot, detourSlotCount);
  const boardOf = (key: number) =>
    Math.floor(Math.floor(key / detourSlotCount) / 2);

  /** 今の区間の、前進までの盤面の並び（`current` を除き、前進した先の盤面で終わる）と、前進した後の遠回りの枠。 */
  function findSegment(): { boards: number[]; slot: number } | null {
    const parents = new Map<number, number>();
    const startKey = keyOf(current, afterDaughterMove, slot);
    parents.set(startKey, -1);
    const toBoards = (key: number, advanced: number) => {
      const boards = [advanced];
      for (let at = key; at !== startKey; at = parents.get(at)!) {
        boards.push(boardOf(at));
      }
      return boards.reverse();
    };
    let frontier: SegmentState[] = [
      { board: current, afterDaughterMove, slot, steps: 0 },
    ];
    while (frontier.length > 0) {
      const next: SegmentState[] = [];
      for (const state of frontier) {
        const key = keyOf(state.board, state.afterDaughterMove, state.slot);
        for (
          let edge = edgeStarts[state.board]!;
          edge < edgeStarts[state.board + 1]!;
          edge += 1
        ) {
          const target = edges[edge]!;
          const movesDaughter = slidePeaks[edge]! >= 0;
          if (
            slidePeaks[edge]! > limit ||
            onPath.has(target) ||
            (movesDaughter && state.afterDaughterMove)
          ) {
            continue;
          }
          const targetSlot =
            state.slot === unlimitedSlot ||
            distance[target]! <= distance[state.board]!
              ? state.slot
              : state.slot - 1;
          if (targetSlot < 0) {
            continue;
          }
          const value = afterAdvance[keyOf(target, true, targetSlot)]!;
          if (
            distance[target]! < threshold &&
            distance[target]! < distance[state.board]! &&
            value >= 0 &&
            value <= preparation
          ) {
            return { boards: toBoards(key, target), slot: targetSlot };
          }
          const targetKey = keyOf(target, movesDaughter, targetSlot);
          if (
            state.steps + 1 <= preparation &&
            distance[target]! <= limit &&
            optimal[target]! > 0 &&
            !parents.has(targetKey)
          ) {
            parents.set(targetKey, key);
            next.push({
              board: target,
              afterDaughterMove: movesDaughter,
              slot: targetSlot,
              steps: state.steps + 1,
            });
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  while (optimal[current] !== 0) {
    const segment = findSegment();
    if (!segment) {
      return null;
    }
    for (const board of segment.boards) {
      if (onPath.has(board)) {
        return null;
      }
      onPath.add(board);
      path.push(board);
    }
    current = path.at(-1)!;
    limit = distance[current]!;
    threshold = limit;
    slot = segment.slot;
    afterDaughterMove = true;
  }
  return path;
}

/**
 * 解の道（盤面の並び）の準備の長さと娘の遠回りを、全局面の値を使わずに道の上だけで数え直す。`--verify` が生成とは別の手順で
 * 確かめるのに使う。1手で娘が通る位置の距離は、その手の前の盤面で娘だけを動かして、始めから終わりへ行ける道の最大の距離の最小。
 * - `preparation`: 前進（娘の距離を減らし、直前の前進の距離を下回り、その後の手で（1手の途中を含めて）二度と上回らない手）と
 *   前進のあいだの手の数の最長。
 * - `detour`: 娘の距離が増える手の数。
 * - `simple`: 同じ盤面を2度通らないか。
 * - `separateDaughterMoves`: 娘を動かす手が続かないか。続く2手は同じ1手なので、続く道の値は SPEC の手数と合わない。
 */
export function measureHakoiriMusumePathPreparation(
  boards: readonly HakoiriMusumeBoardText[],
): {
  preparation: number;
  detour: number;
  simple: boolean;
  separateDaughterMoves: boolean;
} {
  const distances = boards.map((board) =>
    measureHakoiriMusumeDaughterDistance(findHakoiriMusumeDaughterCell(board)),
  );
  const peaks = boards.map((board, index) =>
    index === 0 ? -1 : measureMovePeak(boards[index - 1]!, board),
  );
  const moveCount = boards.length - 1;
  const laterMaximum = new Array<number>(moveCount + 1).fill(-1);
  for (let index = moveCount - 1; index >= 0; index -= 1) {
    laterMaximum[index] = Math.max(
      laterMaximum[index + 1]!,
      peaks[index + 1]!,
      distances[index + 1]!,
    );
  }
  let base = distances[0]!;
  let previousAdvance = 0;
  let preparation = 0;
  let detour = 0;
  for (let index = 1; index <= moveCount; index += 1) {
    const here = distances[index]!;
    if (here > distances[index - 1]!) {
      detour += 1;
    }
    if (
      here < distances[index - 1]! &&
      here < base &&
      laterMaximum[index]! <= here
    ) {
      preparation = Math.max(preparation, index - previousAdvance - 1);
      previousAdvance = index;
      base = here;
    }
  }
  return {
    preparation,
    detour,
    simple: new Set(boards).size === boards.length,
    separateDaughterMoves: peaks.every(
      (peak, index) => peak < 0 || index === 0 || peaks[index - 1]! < 0,
    ),
  };
}

/** 盤面 `from` から `to` への1手で、娘が通る位置の距離の最大の最小。娘が動かなければ -1。 */
function measureMovePeak(
  from: HakoiriMusumeBoardText,
  to: HakoiriMusumeBoardText,
): number {
  const start = findHakoiriMusumeDaughterCell(from);
  const goal = findHakoiriMusumeDaughterCell(to);
  if (start === goal) {
    return -1;
  }
  const canHold = (anchor: number) => {
    const { row, column } = getHakoiriMusumeCellPosition(anchor);
    if (row + 2 > HAKOIRI_MUSUME_ROWS || column + 2 > HAKOIRI_MUSUME_COLUMNS) {
      return false;
    }
    return [0, 1, HAKOIRI_MUSUME_COLUMNS, HAKOIRI_MUSUME_COLUMNS + 1].every(
      (offset) =>
        from[anchor + offset] === "." || from[anchor + offset] === "A",
    );
  };
  for (
    let peak = Math.max(
      measureHakoiriMusumeDaughterDistance(start),
      measureHakoiriMusumeDaughterDistance(goal),
    );
    peak <= FIRST_SEGMENT_LIMIT;
    peak += 1
  ) {
    const reached = new Set([start]);
    const queue = [start];
    for (let head = 0; head < queue.length; head += 1) {
      const { row, column } = getHakoiriMusumeCellPosition(queue[head]!);
      for (const [nextRow, nextColumn] of [
        [row - 1, column],
        [row + 1, column],
        [row, column - 1],
        [row, column + 1],
      ] as const) {
        const next = nextRow * HAKOIRI_MUSUME_COLUMNS + nextColumn;
        if (
          nextRow >= 0 &&
          nextColumn >= 0 &&
          nextColumn < HAKOIRI_MUSUME_COLUMNS &&
          !reached.has(next) &&
          canHold(next) &&
          measureHakoiriMusumeDaughterDistance(next) <= peak
        ) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
    if (reached.has(goal)) {
      return peak;
    }
  }
  return Number.POSITIVE_INFINITY;
}

/** 娘の左上を `anchor` へ置き直した盤面。そこに娘を置けなければ `null`。 */
function relocateDaughter(
  board: HakoiriMusumeBoardText,
  anchor: number,
): HakoiriMusumeBoardText | null {
  const { row, column } = getHakoiriMusumeCellPosition(anchor);
  if (row + 2 > HAKOIRI_MUSUME_ROWS || column + 2 > HAKOIRI_MUSUME_COLUMNS) {
    return null;
  }
  const cells = [...board].map((character) =>
    character === "A" ? "." : character,
  );
  for (const offset of [
    0,
    1,
    HAKOIRI_MUSUME_COLUMNS,
    HAKOIRI_MUSUME_COLUMNS + 1,
  ]) {
    if (cells[anchor + offset] !== ".") {
      return null;
    }
    cells[anchor + offset] = "A";
  }
  return cells.join("");
}

/** 盤面 `to` が `from` から1手で行けるか。 */
function isOneMove(
  from: HakoiriMusumeBoardText,
  to: HakoiriMusumeBoardText,
): boolean {
  return listHakoiriMusumeNextBoards(from).includes(to);
}

/** 娘の左上が置ける位置（行0〜3・列0〜2）。 */
const daughterAnchors = Array.from(
  { length: HAKOIRI_MUSUME_CELL_COUNT },
  (_, cell) => cell,
).filter((cell) => {
  const { row, column } = getHakoiriMusumeCellPosition(cell);
  return row + 2 <= HAKOIRI_MUSUME_ROWS && column + 2 <= HAKOIRI_MUSUME_COLUMNS;
});

/**
 * 解の道（盤面の並び）で、娘の手・ほかの駒の手（1つ以上）・娘の手、の並びのうち、2つの娘の手を、あいだのほかの駒の手と
 * 入れ替えて娘の1手にまとめられる最初の並びをまとめた道。まとめられる並びが無ければ `null`。まとめ方は次のどちらか。
 * - 前へまとめる: 娘を1つ目の手の前の位置に置いたまま、あいだの手を指し、その後に娘の1手で2つ目の手の後の盤面へ行く。
 * - 後ろへまとめる: 1つ目の手の前の盤面から、娘の1手で2つ目の手の後の位置へ行き、娘をそこに置いたまま、あいだの手を指す。
 * まとめた後に同じ盤面が続けば1つにする（娘が元の位置へ戻る2手は、まとめると手にならない）。
 */
function mergeFirstDaughterMoves(
  boards: readonly HakoiriMusumeBoardText[],
): HakoiriMusumeBoardText[] | null {
  // 直前の娘の手の前の盤面の位置と、あいだの手が娘をどこに置いても指せたかの位置の集まり。
  let beforeDaughterMove: number | null = null;
  let keptAnchors = new Set<number>();
  const relocateAll = (from: number, to: number, anchor: number) =>
    boards.slice(from, to + 1).map((board) => relocateDaughter(board, anchor)!);
  for (let index = 1; index < boards.length; index += 1) {
    const from = boards[index - 1]!;
    const to = boards[index]!;
    const movesDaughter =
      findHakoiriMusumeDaughterCell(from) !== findHakoiriMusumeDaughterCell(to);
    if (movesDaughter) {
      if (beforeDaughterMove !== null) {
        const start = beforeDaughterMove;
        const startBoard = boards[start]!;
        const origin = findHakoiriMusumeDaughterCell(startBoard);
        const target = findHakoiriMusumeDaughterCell(to);
        let merged: HakoiriMusumeBoardText[] | null = null;
        if (keptAnchors.has(origin)) {
          const returned = relocateDaughter(from, origin);
          if (
            returned !== null &&
            (returned === to || isOneMove(returned, to))
          ) {
            merged = [
              startBoard,
              ...relocateAll(start + 2, index - 1, origin),
              to,
            ];
          }
        }
        if (merged === null && keptAnchors.has(target)) {
          const slid = relocateDaughter(startBoard, target);
          if (
            slid !== null &&
            (slid === startBoard || isOneMove(startBoard, slid))
          ) {
            merged = [startBoard, ...relocateAll(start + 1, index - 1, target)];
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
      beforeDaughterMove = index - 1;
      keptAnchors = new Set(
        daughterAnchors.filter(
          (anchor) => relocateDaughter(to, anchor) !== null,
        ),
      );
      continue;
    }
    if (beforeDaughterMove === null) {
      continue;
    }
    keptAnchors = new Set(
      [...keptAnchors].filter((anchor) => {
        const relocatedFrom = relocateDaughter(from, anchor);
        const relocatedTo = relocateDaughter(to, anchor);
        return (
          relocatedFrom !== null &&
          relocatedTo !== null &&
          isOneMove(relocatedFrom, relocatedTo)
        );
      }),
    );
    if (keptAnchors.size === 0) {
      beforeDaughterMove = null;
    }
  }
  return null;
}

/**
 * 解の道で、ほかの駒の手と入れ替えて娘の1手にまとめられる2つの娘の手を、まとめられなくなるまでまとめた道。
 * まとめるたびに手が減るので、必ず終わる。
 */
export function mergeHakoiriMusumeDaughterMoves(
  boards: readonly HakoiriMusumeBoardText[],
): HakoiriMusumeBoardText[] {
  let current = [...boards];
  for (
    let merged = mergeFirstDaughterMoves(current);
    merged !== null;
    merged = mergeFirstDaughterMoves(current)
  ) {
    current = merged;
  }
  return current;
}

/**
 * 解の道の準備の長さと遠回りが、娘の1手を分けたことで下がった値でないか。まとめられる娘の手をまとめた道の上で数え直し、
 * 元の道の値と同じなら `true`。娘の1手を、入れ替えられるほかの駒の手を挟んで2つに分けると、2つ目が前進になって準備の長さが
 * 下がることがある。準備の長さの数え方は変えず、値が変わる道でしか確かめられない問題を問題集に採らないために使う。
 */
export function keepsHakoiriMusumePreparationWhenMerged(
  boards: readonly HakoiriMusumeBoardText[],
): boolean {
  const original = measureHakoiriMusumePathPreparation(boards);
  const merged = measureHakoiriMusumePathPreparation(
    mergeHakoiriMusumeDaughterMoves(boards),
  );
  return (
    merged.preparation === original.preparation &&
    merged.detour === original.detour
  );
}
