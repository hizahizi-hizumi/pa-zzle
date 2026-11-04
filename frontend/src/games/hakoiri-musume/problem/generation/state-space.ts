import {
  HAKOIRI_MUSUME_CELL_COUNT,
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_GOAL_CELL,
  HAKOIRI_MUSUME_ROWS,
  type HakoiriMusumePieceKind,
  hakoiriMusumePieceShapes,
} from "@/games/hakoiri-musume/puzzle/board";

/**
 * 盤面の20文字（`formatHakoiriMusumeBoard` の書き方）。同じ種類の駒どうしを区別しないので、状態の見分けにそのまま使う。
 * 全状態をたどる処理は駒の値を作らず、この文字列だけで進める。
 */
export type HakoiriMusumeBoardText = string;

/** 駒の組。娘は必ず1つ。 */
export type HakoiriMusumePieceSet = {
  vertical: number;
  horizontal: number;
  small: number;
};

type PieceLayout = {
  kind: HakoiriMusumePieceKind;
  /** 左上のマスごとの、駒が覆うマスと書く文字。 */
  cellsByAnchor: ReadonlyMap<number, readonly (readonly [number, string])[]>;
};

const notationByKind = {
  daughter: ["A", "A", "A", "A"],
  vertical: ["v", "w"],
  horizontal: ["h", "i"],
  small: ["s"],
} as const satisfies Record<HakoiriMusumePieceKind, readonly string[]>;

const kindByLeading: Readonly<Record<string, HakoiriMusumePieceKind>> = {
  A: "daughter",
  v: "vertical",
  h: "horizontal",
  s: "small",
};

function createLayout(kind: HakoiriMusumePieceKind): PieceLayout {
  const { columns, rows } = hakoiriMusumePieceShapes[kind];
  const notations = notationByKind[kind];
  const cellsByAnchor = new Map<number, (readonly [number, string])[]>();
  for (let row = 0; row + rows <= HAKOIRI_MUSUME_ROWS; row += 1) {
    for (
      let column = 0;
      column + columns <= HAKOIRI_MUSUME_COLUMNS;
      column += 1
    ) {
      const cells: (readonly [number, string])[] = [];
      for (let rowOffset = 0; rowOffset < rows; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < columns; columnOffset += 1) {
          cells.push([
            (row + rowOffset) * HAKOIRI_MUSUME_COLUMNS + column + columnOffset,
            notations[cells.length]!,
          ]);
        }
      }
      cellsByAnchor.set(row * HAKOIRI_MUSUME_COLUMNS + column, cells);
    }
  }
  return { kind, cellsByAnchor };
}

const layouts = {
  daughter: createLayout("daughter"),
  vertical: createLayout("vertical"),
  horizontal: createLayout("horizontal"),
  small: createLayout("small"),
} as const satisfies Record<HakoiriMusumePieceKind, PieceLayout>;

const neighborOffsets = [
  -HAKOIRI_MUSUME_COLUMNS,
  1,
  HAKOIRI_MUSUME_COLUMNS,
  -1,
] as const;

/** 左上のマス `anchor` から `offset` だけずらした左上のマス。盤面の端を越えるなら `null`。 */
function shiftAnchor(anchor: number, offset: number): number | null {
  const column = anchor % HAKOIRI_MUSUME_COLUMNS;
  if (
    (offset === 1 && column === HAKOIRI_MUSUME_COLUMNS - 1) ||
    (offset === -1 && column === 0)
  ) {
    return null;
  }
  const next = anchor + offset;
  return next >= 0 && next < HAKOIRI_MUSUME_CELL_COUNT ? next : null;
}

/** 盤面の駒の左上のマスと種類を、左上のマスの順に並べる。 */
function listAnchors(
  board: HakoiriMusumeBoardText,
): { kind: HakoiriMusumePieceKind; anchor: number }[] {
  const anchors: { kind: HakoiriMusumePieceKind; anchor: number }[] = [];
  for (let cell = 0; cell < HAKOIRI_MUSUME_CELL_COUNT; cell += 1) {
    const kind = kindByLeading[board[cell]!];
    // 娘は4マスとも `A` なので、左上（左と上が娘でないマス）だけを駒の始まりとする。
    if (
      kind &&
      !(
        kind === "daughter" &&
        ((cell % HAKOIRI_MUSUME_COLUMNS > 0 && board[cell - 1] === "A") ||
          (cell >= HAKOIRI_MUSUME_COLUMNS &&
            board[cell - HAKOIRI_MUSUME_COLUMNS] === "A"))
      )
    ) {
      anchors.push({ kind, anchor: cell });
    }
  }
  return anchors;
}

/**
 * 1手で行ける盤面。1手は1つの駒を、ほかの駒を動かさずに空いたマスを何回曲がってもたどれる所へ動かすこと。
 * 同じ種類の駒どうしは区別しないので、行き先の盤面が同じになる手は1つにまとめる。
 */
export function listHakoiriMusumeNextBoards(
  board: HakoiriMusumeBoardText,
): HakoiriMusumeBoardText[] {
  const results = new Set<HakoiriMusumeBoardText>();
  const characters = board.split("");
  for (const { kind, anchor } of listAnchors(board)) {
    const { cellsByAnchor } = layouts[kind];
    const ownCells = cellsByAnchor.get(anchor)!;
    for (const [cell] of ownCells) {
      characters[cell] = ".";
    }
    function isFree(target: number): boolean {
      return (
        cellsByAnchor
          .get(target)
          ?.every(([cell]) => characters[cell] === ".") ?? false
      );
    }
    const visited = new Set([anchor]);
    const queue = [anchor];
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]!;
      for (const offset of neighborOffsets) {
        const next = shiftAnchor(current, offset);
        if (next === null || visited.has(next) || !isFree(next)) {
          continue;
        }
        visited.add(next);
        queue.push(next);
        const moved = characters.slice();
        for (const [cell, notation] of cellsByAnchor.get(next)!) {
          moved[cell] = notation;
        }
        results.add(moved.join(""));
      }
    }
    for (const [cell, notation] of ownCells) {
      characters[cell] = notation;
    }
  }
  return [...results];
}

/** 左右を反転した盤面。出口が左右対称なので、反転した盤面は同じ問題とみなす。 */
export function mirrorHakoiriMusumeBoard(
  board: HakoiriMusumeBoardText,
): HakoiriMusumeBoardText {
  const characters = new Array<string>(HAKOIRI_MUSUME_CELL_COUNT).fill(".");
  for (const { kind, anchor } of listAnchors(board)) {
    const { columns } = hakoiriMusumePieceShapes[kind];
    const row = Math.floor(anchor / HAKOIRI_MUSUME_COLUMNS);
    const column = anchor % HAKOIRI_MUSUME_COLUMNS;
    const mirrored =
      row * HAKOIRI_MUSUME_COLUMNS +
      (HAKOIRI_MUSUME_COLUMNS - columns - column);
    for (const [cell, notation] of layouts[kind].cellsByAnchor.get(mirrored)!) {
      characters[cell] = notation;
    }
  }
  return characters.join("");
}

/** 盤面の娘の左上のマス。 */
export function findHakoiriMusumeDaughterCell(
  board: HakoiriMusumeBoardText,
): number {
  return board.indexOf("A");
}

/** 盤面の駒の組。 */
export function countHakoiriMusumePieceSet(
  board: HakoiriMusumeBoardText,
): HakoiriMusumePieceSet {
  function count(character: string): number {
    return board.split(character).length - 1;
  }
  return { vertical: count("v"), horizontal: count("h"), small: count("s") };
}

export function countHakoiriMusumeEmptyCells(
  board: HakoiriMusumeBoardText,
): number {
  return board.split(".").length - 1;
}

/** 駒の組の置き方をすべて数え上げる。左上のマスから順に、空きか、そのマスを左上とする駒を置く。 */
export function enumerateHakoiriMusumePieceSetBoards({
  vertical,
  horizontal,
  small,
}: HakoiriMusumePieceSet): HakoiriMusumeBoardText[] {
  const emptyCount =
    HAKOIRI_MUSUME_CELL_COUNT - 4 - 2 * (vertical + horizontal) - small;
  if (emptyCount < 0) {
    return [];
  }
  const remaining: Record<HakoiriMusumePieceKind, number> = {
    daughter: 1,
    vertical,
    horizontal,
    small,
  };
  const characters = new Array<string>(HAKOIRI_MUSUME_CELL_COUNT).fill("");
  const boards: HakoiriMusumeBoardText[] = [];
  const kinds: readonly HakoiriMusumePieceKind[] = [
    "daughter",
    "vertical",
    "horizontal",
    "small",
  ];
  function place(cell: number, empties: number) {
    let next = cell;
    while (next < HAKOIRI_MUSUME_CELL_COUNT && characters[next] !== "") {
      next += 1;
    }
    if (next === HAKOIRI_MUSUME_CELL_COUNT) {
      boards.push(characters.join(""));
      return;
    }
    if (empties > 0) {
      characters[next] = ".";
      place(next + 1, empties - 1);
      characters[next] = "";
    }
    for (const kind of kinds) {
      const cells = layouts[kind].cellsByAnchor.get(next);
      if (
        remaining[kind] === 0 ||
        !cells ||
        cells.some(([target]) => characters[target] !== "")
      ) {
        continue;
      }
      remaining[kind] -= 1;
      for (const [target, notation] of cells) {
        characters[target] = notation;
      }
      place(next + 1, empties);
      for (const [target] of cells) {
        characters[target] = "";
      }
      remaining[kind] += 1;
    }
  }
  place(0, emptyCount);
  return boards;
}

/** 盤面の集まりと、1手で行ける盤面への辺。辺は `edgeStarts[i]` から `edgeStarts[i + 1]` の手前まで。 */
export type HakoiriMusumeStateGraph = {
  boards: readonly HakoiriMusumeBoardText[];
  indexByBoard: ReadonlyMap<HakoiriMusumeBoardText, number>;
  edgeStarts: Int32Array;
  edges: Int32Array;
};

/** 1手で閉じた盤面の集まり（駒の組の全部、または連結成分）から辺を作る。 */
export function createHakoiriMusumeStateGraph(
  boards: readonly HakoiriMusumeBoardText[],
): HakoiriMusumeStateGraph {
  const indexByBoard = new Map(boards.map((board, index) => [board, index]));
  const edgeStarts = new Int32Array(boards.length + 1);
  const edgeList: number[] = [];
  boards.forEach((board, index) => {
    edgeStarts[index] = edgeList.length;
    for (const next of listHakoiriMusumeNextBoards(board)) {
      const target = indexByBoard.get(next);
      if (target === undefined) {
        throw new Error(`State graph is not closed: ${next}`);
      }
      edgeList.push(target);
    }
  });
  edgeStarts[boards.length] = edgeList.length;
  return { boards, indexByBoard, edgeStarts, edges: Int32Array.from(edgeList) };
}

/** 始めの盤面から1手ずつたどれる盤面（連結成分）と、その辺。盤面は始めの盤面から近い順に並ぶ。 */
export function createHakoiriMusumeComponentGraph(
  start: HakoiriMusumeBoardText,
): HakoiriMusumeStateGraph {
  const boards = [start];
  const indexByBoard = new Map([[start, 0]]);
  const edgeStarts: number[] = [];
  const edgeList: number[] = [];
  for (let current = 0; current < boards.length; current += 1) {
    edgeStarts.push(edgeList.length);
    for (const next of listHakoiriMusumeNextBoards(boards[current]!)) {
      let target = indexByBoard.get(next);
      if (target === undefined) {
        target = boards.length;
        indexByBoard.set(next, target);
        boards.push(next);
      }
      edgeList.push(target);
    }
  }
  edgeStarts.push(edgeList.length);
  return {
    boards,
    indexByBoard,
    edgeStarts: Int32Array.from(edgeStarts),
    edges: Int32Array.from(edgeList),
  };
}

/**
 * 盤面ごとの、最短手数と難易度の特徴。
 * - `optimal`: 娘を出口の前へ運ぶ最短手数。運べなければ -1。
 * - `preparation`: 準備の長さ。娘が出口へ今までで最も近づく（出口の前との距離が今までの最小を下回る）手を「前進」とし、
 *   前進と前進のあいだに要る手の数の最長。どんな長さの解でもよく、その最長が最も小さくなる解で数える。
 *   娘を往復させても、遠ざけた分を戻す手は前進にならないので、手を足して短くすることはできない。
 * - `detour`: 娘の遠回り。娘の左上と出口の前のマンハッタン距離が増える手の数。どんな長さの解でもよく、最も少ない解で数える。
 * - `lure`・`daughterMoves`・`optimalFirstMoves`: 最短解の上で、値が最も少ない解で数える（記録だけ）。
 *   誘いの局面の数、娘を動かす手の数、最短手数を縮める初手の数。
 * - `firstMoves`: 初手の合法手の数。
 */
export type HakoiriMusumeStateMeasures = {
  optimal: Int32Array;
  preparation: Int32Array;
  detour: Int32Array;
  lure: Int32Array;
  daughterMoves: Int32Array;
  optimalFirstMoves: Int32Array;
  firstMoves: Int32Array;
};

const goalPosition = {
  row: Math.floor(HAKOIRI_MUSUME_GOAL_CELL / HAKOIRI_MUSUME_COLUMNS),
  column: HAKOIRI_MUSUME_GOAL_CELL % HAKOIRI_MUSUME_COLUMNS,
};

/** 娘の左上と出口の前のマンハッタン距離。娘が盤面のどこにいても 4 以下。 */
export function measureHakoiriMusumeDaughterDistance(
  daughterCell: number,
): number {
  return (
    Math.abs(
      Math.floor(daughterCell / HAKOIRI_MUSUME_COLUMNS) - goalPosition.row,
    ) + Math.abs((daughterCell % HAKOIRI_MUSUME_COLUMNS) - goalPosition.column)
  );
}

const maximumDaughterDistance = 4;
const unreached = 2_147_483_647;

/**
 * 準備の長さ（`HakoiriMusumeStateMeasures` の `preparation`）。前進した直後の盤面（娘が今までで最も出口に近い盤面）ごとに、
 * 次の前進までに要る手の数と、その先の準備の長さの大きい方を、最も小さくする。距離の小さい盤面から順に求める。運べなければ -1。
 *
 * 距離 `r` の盤面 `u` の値は、距離 `r` 以上の盤面だけを通って、距離が `r` より小さい盤面 `v` へ動ける盤面 `w` までの手の数
 * `d(u, w)` と、`v` の値 `c` の組の `max(d, c)` の最小。値が `T` 以下になるのは、`c` が `T` 以下の `w` のどれかへ `T` 手以内で
 * 行けるときなので、`T` を 0 から1つずつ上げ、`c` が `T` の `w` を起点に足しながら、起点からの手の数を幅優先で更新していく。
 */
function measureRecordPreparation(
  graph: HakoiriMusumeStateGraph,
  distance: Int32Array,
  optimal: Int32Array,
): Int32Array {
  const { boards, edgeStarts, edges } = graph;
  const count = boards.length;
  const preparation = new Int32Array(count).fill(-1);
  for (let index = 0; index < count; index += 1) {
    if (optimal[index] === 0) {
      preparation[index] = 0;
    }
  }
  const stepsToExit = new Int32Array(count);
  for (let record = 1; record <= maximumDaughterDistance; record += 1) {
    stepsToExit.fill(unreached);
    const exitsByValue: number[][] = [];
    for (let exit = 0; exit < count; exit += 1) {
      if (distance[exit]! < record) {
        continue;
      }
      let best = unreached;
      for (
        let edge = edgeStarts[exit]!;
        edge < edgeStarts[exit + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        if (distance[next]! < record && preparation[next]! >= 0) {
          best = Math.min(best, preparation[next]!);
        }
      }
      if (best !== unreached) {
        (exitsByValue[best] ??= []).push(exit);
      }
    }
    // 値を求める盤面は、距離 `r` で、前進できる盤面（`r` を下回る盤面へ動ける盤面）へたどり着けるものだけ。
    let pending = boards.flatMap((_, index) =>
      distance[index] === record && optimal[index]! > 0 ? [index] : [],
    );
    for (
      let threshold = 0;
      pending.length > 0 && threshold < count;
      threshold += 1
    ) {
      const queue = exitsByValue[threshold] ?? [];
      for (const exit of queue) {
        stepsToExit[exit] = 0;
      }
      for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head]!;
        for (
          let edge = edgeStarts[current]!;
          edge < edgeStarts[current + 1]!;
          edge += 1
        ) {
          const previous = edges[edge]!;
          if (
            distance[previous]! >= record &&
            stepsToExit[current]! + 1 < stepsToExit[previous]!
          ) {
            stepsToExit[previous] = stepsToExit[current]! + 1;
            queue.push(previous);
          }
        }
      }
      pending = pending.filter((index) => {
        if (stepsToExit[index]! <= threshold) {
          preparation[index] = threshold;
          return false;
        }
        return true;
      });
    }
  }
  return preparation;
}

/**
 * 娘の遠回り（`HakoiriMusumeStateMeasures` の `detour`）。娘を出口から遠ざける手を 1、ほかの手を 0 とした、出口の前までの最小の和。
 * 手は戻せる（辺は両向き）ので、出口の前から逆にたどる 0-1 の幅優先探索で求める。運べなければ -1。
 */
function measureDetour(
  graph: HakoiriMusumeStateGraph,
  distance: Int32Array,
  optimal: Int32Array,
): Int32Array {
  const { boards, edgeStarts, edges } = graph;
  const detour = new Int32Array(boards.length).fill(unreached);
  let level: number[] = [];
  boards.forEach((_, index) => {
    if (optimal[index] === 0) {
      detour[index] = 0;
      level.push(index);
    }
  });
  for (let cost = 0; level.length > 0; cost += 1) {
    const nextLevel: number[] = [];
    for (let head = 0; head < level.length; head += 1) {
      const current = level[head]!;
      if (detour[current] !== cost) {
        continue;
      }
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const previous = edges[edge]!;
        const away = distance[current]! > distance[previous]! ? 1 : 0;
        if (cost + away < detour[previous]!) {
          detour[previous] = cost + away;
          (away ? nextLevel : level).push(previous);
        }
      }
    }
    level = nextLevel;
  }
  return detour.map((value) => (value === unreached ? -1 : value));
}

/** ゴール（娘が出口の前）からの多始点の幅優先探索で最短手数を求め、特徴を求める。 */
export function measureHakoiriMusumeStateGraph(
  graph: HakoiriMusumeStateGraph,
): HakoiriMusumeStateMeasures {
  const { boards, edgeStarts, edges } = graph;
  const count = boards.length;
  const daughterCell = Int32Array.from(boards, findHakoiriMusumeDaughterCell);
  const distance = Int32Array.from(
    daughterCell,
    measureHakoiriMusumeDaughterDistance,
  );
  const optimal = new Int32Array(count).fill(-1);
  const order: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (daughterCell[index] === HAKOIRI_MUSUME_GOAL_CELL) {
      optimal[index] = 0;
      order.push(index);
    }
  }
  for (let head = 0; head < order.length; head += 1) {
    const current = order[head]!;
    for (
      let edge = edgeStarts[current]!;
      edge < edgeStarts[current + 1]!;
      edge += 1
    ) {
      const next = edges[edge]!;
      if (optimal[next] === -1) {
        optimal[next] = optimal[current]! + 1;
        order.push(next);
      }
    }
  }

  const measures: HakoiriMusumeStateMeasures = {
    optimal,
    preparation: measureRecordPreparation(graph, distance, optimal),
    detour: measureDetour(graph, distance, optimal),
    lure: new Int32Array(count),
    daughterMoves: new Int32Array(count),
    optimalFirstMoves: new Int32Array(count),
    firstMoves: new Int32Array(count),
  };
  for (const current of order) {
    if (optimal[current] === 0) {
      continue;
    }
    const remaining = optimal[current]!;
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
    let lure = Number.POSITIVE_INFINITY;
    let daughterMoves = Number.POSITIVE_INFINITY;
    let optimalFirstMoves = 0;
    for (
      let edge = edgeStarts[current]!;
      edge < edgeStarts[current + 1]!;
      edge += 1
    ) {
      const next = edges[edge]!;
      if (optimal[next] !== remaining - 1) {
        continue;
      }
      optimalFirstMoves += 1;
      const movesDaughter = daughterCell[next] !== daughterCell[current];
      lure = Math.min(lure, (tempted ? 1 : 0) + measures.lure[next]!);
      daughterMoves = Math.min(
        daughterMoves,
        (movesDaughter ? 1 : 0) + measures.daughterMoves[next]!,
      );
    }
    measures.lure[current] = lure;
    measures.daughterMoves[current] = daughterMoves;
    measures.optimalFirstMoves[current] = optimalFirstMoves;
  }
  for (let index = 0; index < count; index += 1) {
    measures.firstMoves[index] = edgeStarts[index + 1]! - edgeStarts[index]!;
  }
  return measures;
}
