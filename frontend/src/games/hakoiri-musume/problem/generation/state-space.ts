import { HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT } from "@/games/hakoiri-musume/problem/daughter-detour";
import {
  getHakoiriMusumeCellPosition,
  HAKOIRI_MUSUME_CELL_COUNT,
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_GOAL_CELL,
  HAKOIRI_MUSUME_ROWS,
  type HakoiriMusumePieceKind,
  hakoiriMusumeNotationByPieceCell,
  hakoiriMusumePieceKindByLeadingNotation,
  hakoiriMusumePieceShapes,
  isHakoiriMusumeLeadingNotation,
  listHakoiriMusumePieceCellsAt,
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

function createLayout(kind: HakoiriMusumePieceKind): PieceLayout {
  const { columns, rows } = hakoiriMusumePieceShapes[kind];
  const notations = hakoiriMusumeNotationByPieceCell[kind];
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
    const character = board[cell]!;
    const kind = isHakoiriMusumeLeadingNotation(character)
      ? hakoiriMusumePieceKindByLeadingNotation[character]
      : null;
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

/** 駒の組を置いたときの空きマスの数。駒の組だけで決まる。 */
export function countHakoiriMusumePieceSetEmptyCells({
  vertical,
  horizontal,
  small,
}: HakoiriMusumePieceSet): number {
  const cellsOf = (kind: HakoiriMusumePieceKind) =>
    hakoiriMusumePieceShapes[kind].columns *
    hakoiriMusumePieceShapes[kind].rows;
  return (
    HAKOIRI_MUSUME_CELL_COUNT -
    cellsOf("daughter") -
    vertical * cellsOf("vertical") -
    horizontal * cellsOf("horizontal") -
    small * cellsOf("small")
  );
}

/** 駒の組の置き方をすべて数え上げる。左上のマスから順に、空きか、そのマスを左上とする駒を置く。 */
export function enumerateHakoiriMusumePieceSetBoards({
  vertical,
  horizontal,
  small,
}: HakoiriMusumePieceSet): HakoiriMusumeBoardText[] {
  const emptyCount = countHakoiriMusumePieceSetEmptyCells({
    vertical,
    horizontal,
    small,
  });
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
 * - `preparation`: 準備の長さ。娘の距離を減らし、直前の前進の距離（始めは始めの盤面の距離）を下回り、その後二度と上回らない
 *   手を「前進」とし、前進と前進のあいだに要る手の数の最長。「上回らない」には、1手の滑りの途中で娘が通る位置の距離も含める。
 *   どんな長さの解でもよく、その最長が最も小さくなる解で数える。娘を往復させても、一時的に前へ出して戻しても、1手の中で
 *   遠回りして戻っても、その手は前進を作らないので、手を足したりまとめたりして短くすることはできない。一時的に前へ出した手は、
 *   後の前進の基準を変えないので、値を大きくすることもない。
 * - `shortestPreparation`: 最短の解だけで数えた準備の長さ。最短の解の中で、準備の長さが最も小さくなる解で数える。
 * - `detour`: 娘の遠回り。娘の左上と出口の前のマンハッタン距離が増える手の数。準備の長さを最も小さくする解の中で、最も少ない
 *   解で数える（2つの量を同じ解の上で取る）。`HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT` を超える回数は、その1つ上にまとめる。
 * - `lure`・`daughterMoves`・`optimalFirstMoves`: 最短解の上で、値が最も少ない解で数える（記録だけ）。
 *   誘いの局面の数、娘を動かす手の数、最短手数を縮める初手の数。
 * - `firstMoves`: 初手の合法手の数。
 */
export type HakoiriMusumeStateMeasures = {
  optimal: Int32Array;
  /** 準備の長さを与える解をたどり直すための途中の値（`HakoiriMusumePreparationTrace`）。 */
  preparationTrace: HakoiriMusumePreparationTrace;
  preparation: Int32Array;
  shortestPreparation: Int32Array;
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
 * 辺ごとの、その1手で娘が通る位置の距離の最大（娘を動かさない手は -1）。娘は1手の中で何マスも曲がって滑れるので、
 * 手の終わりの距離だけでは途中で遠いマスを通ったかが分からない。ほかの駒を止めたまま娘の左上が動ける位置をたどり、
 * 始めから終わりへ行ける道のうち、通る距離の最大が最も小さい道の値を取る（遊ぶ人はその道を選べる）。
 */
function measureDaughterSlidePeaks(
  graph: HakoiriMusumeStateGraph,
  daughterCell: Int32Array,
): Int8Array {
  const { boards, edgeStarts, edges } = graph;
  const peaks = new Int8Array(edges.length).fill(-1);
  const daughterCells = listHakoiriMusumePieceCellsAt(
    "daughter",
    getHakoiriMusumeCellPosition(0),
  );
  for (let from = 0; from < boards.length; from += 1) {
    const board = boards[from]!;
    const start = daughterCell[from]!;
    for (
      let edge = edgeStarts[from]!;
      edge < edgeStarts[from + 1]!;
      edge += 1
    ) {
      const goal = daughterCell[edges[edge]!]!;
      if (goal === start) {
        continue;
      }
      const isFree = (anchor: number) => {
        const { row, column } = getHakoiriMusumeCellPosition(anchor);
        if (
          row + hakoiriMusumePieceShapes.daughter.rows > HAKOIRI_MUSUME_ROWS ||
          column + hakoiriMusumePieceShapes.daughter.columns >
            HAKOIRI_MUSUME_COLUMNS
        ) {
          return false;
        }
        return daughterCells.every((offset) => {
          const character = board[anchor + offset]!;
          return character === "." || character === "A";
        });
      };
      for (
        let peak = Math.max(
          measureHakoiriMusumeDaughterDistance(start),
          measureHakoiriMusumeDaughterDistance(goal),
        );
        peak <= maximumDaughterDistance;
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
            if (
              nextRow < 0 ||
              nextColumn < 0 ||
              nextColumn >= HAKOIRI_MUSUME_COLUMNS
            ) {
              continue;
            }
            const next = nextRow * HAKOIRI_MUSUME_COLUMNS + nextColumn;
            if (
              !reached.has(next) &&
              isFree(next) &&
              measureHakoiriMusumeDaughterDistance(next) <= peak
            ) {
              reached.add(next);
              queue.push(next);
            }
          }
        }
        if (reached.has(goal)) {
          peaks[edge] = peak;
          break;
        }
      }
    }
  }
  return peaks;
}

/**
 * 準備の長さを与える解をたどり直すための値。
 * - `distance`: 盤面ごとの娘の距離。
 * - `slidePeaks`: 辺ごとの、その1手で娘が通る位置の距離の最大（娘を動かさない手は -1）。
 * - `afterAdvance`: 前進した直後の盤面（その距離の区間の始め）から出口の前までの準備の長さ。盤面と、直前の手が娘の手か、
 *   遠回りの残りの回数の枠ごとに `toPreparationStateKey` の位置に置く。運べなければ -1。枠は 0〜`HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT`
 *   が遠回りの残りの回数で、最後の枠は遠回りを縛らない。前進は娘の手なので、前進した直後の値は「直前の手が娘の手」の側を引く。
 */
export type HakoiriMusumePreparationTrace = {
  distance: Int32Array;
  slidePeaks: Int8Array;
  afterAdvance: Int32Array;
  detourSlotCount: number;
};

/**
 * 準備の長さを数える探索の状態（盤面・直前の手が娘の手か・遠回りの枠）を、`afterAdvance` などの配列の位置にする。
 * 娘を続けて動かすのは同じ1手なので、解の上で娘の手（辺）を続けて2つ使わない。娘の続けての移動はグラフの1辺に含まれるので、
 * これで失う解は無い。
 */
export function toPreparationStateKey(
  board: number,
  afterDaughterMove: boolean,
  slot: number,
  detourSlotCount: number,
): number {
  return (board * 2 + (afterDaughterMove ? 1 : 0)) * detourSlotCount + slot;
}

type PreparationAndDetour = {
  preparation: Int32Array;
  detour: Int32Array;
  afterAdvance: Int32Array;
  detourSlotCount: number;
};

/**
 * - `maximumCountedDetour`: 遠回りを数えきる回数。-1 なら遠回りを数えない。
 * - `shortestOnly`: 最短の解だけで数える。
 */
type PreparationOptions = {
  maximumCountedDetour: number;
  shortestOnly: boolean;
};

/**
 * 準備の長さと娘の遠回り（`HakoiriMusumeStateMeasures` の `preparation`・`detour`）。運べなければどちらも -1。
 *
 * 解の上で、娘の距離を減らし、直前の前進の距離（始めは始めの盤面の距離）を下回り、その後の解で（1手の滑りの途中を含めて）
 * 二度と上回らない距離へ出る手を「前進」とする。前進の手を除いた手を、前進と前進のあいだ（始めから最初の前進まで、最後の前進から
 * 出口の前まで）で数え、その最長を準備の長さとする。どんな長さの解でもよく、最長が最も小さくなる解で数える。遠回り（娘の距離が
 * 増える手の数）は、準備の長さを最も小さくする解の中で、最も少なくなる解で数える。前進の基準を直前の前進の距離にするので、
 * 娘を一時的に前へ出して戻しても、後の前進が前進でなくなることはない。
 *
 * 区間は、娘の距離の上限 `limit` と、前進と認める距離のしきい値 `threshold` で決まる。距離 `c` へ前進した後の区間は、上限と
 * しきい値がどちらも `c`。始めの区間は、上限が最大の距離 4、しきい値が始めの盤面の距離。1手の途中で娘が上限より遠い位置を通る手
 * （`slidePeaks`）も使えない。区間の始めの値は、前進できる盤面までの手の数と、前進した先の区間の値の大きい方の最小。値が `T` 以下に
 * なるのは、値が `T` 以下の前進へ `T` 手以内で行けるときなので、`T` を 0 から1つずつ上げ、起点を足しながら、起点からの手の数を
 * 幅優先で更新していく。前進した後の区間を距離の小さい順に求め、最後に始めの区間を求める。遠回りの残りの回数ごとに準備の長さを
 * 求め、縛らないときと同じ値になる最も少ない回数を遠回りとする。
 */
function measurePreparationAndDetour(
  graph: HakoiriMusumeStateGraph,
  distance: Int32Array,
  slidePeaks: Int8Array,
  optimal: Int32Array,
  { maximumCountedDetour, shortestOnly }: PreparationOptions,
): PreparationAndDetour {
  const { boards, edgeStarts, edges } = graph;
  const count = boards.length;
  // 遠回りの残りの回数ごとの枠（0〜`maximumCountedDetour`）と、遠回りを縛らない枠。
  const unlimitedDetourSlot = maximumCountedDetour + 1;
  const detourSlotCount = unlimitedDetourSlot + 1;
  // 最短の解だけをたどるときは、最短手数が1つ減る手だけを使う。
  const isUsableMove = (from: number, to: number) =>
    !shortestOnly || optimal[to] === optimal[from]! - 1;
  // 盤面・直前の手が娘の手か・遠回りの枠ごとの値。`preparationBySlot` は始めの盤面、`afterAdvance` は前進した直後の盤面
  // （その距離の区間の始め）。
  const stateCount = count * 2 * detourSlotCount;
  const keyOf = (board: number, afterDaughterMove: boolean, slot: number) =>
    toPreparationStateKey(board, afterDaughterMove, slot, detourSlotCount);
  const preparationBySlot = new Int32Array(stateCount).fill(-1);
  const afterAdvance = new Int32Array(stateCount).fill(-1);
  for (let index = 0; index < count; index += 1) {
    if (optimal[index] === 0) {
      afterAdvance.fill(0, keyOf(index, false, 0), keyOf(index + 1, false, 0));
    }
  }
  const stepsToAdvance = new Int32Array(stateCount);

  const measureSegment = (
    limit: number,
    threshold: number,
    starts: readonly number[],
    values: Int32Array,
  ) => {
    stepsToAdvance.fill(unreached);
    const advancesByValue: number[][] = [];
    // 前進は娘の手なので、直前の手が娘の手でない状態からだけ前進できる。
    for (let current = 0; current < count; current += 1) {
      if (distance[current]! > limit || optimal[current]! <= 0) {
        continue;
      }
      for (let slot = 0; slot < detourSlotCount; slot += 1) {
        let best = unreached;
        for (
          let edge = edgeStarts[current]!;
          edge < edgeStarts[current + 1]!;
          edge += 1
        ) {
          const next = edges[edge]!;
          const value = afterAdvance[keyOf(next, true, slot)]!;
          if (
            distance[next]! < threshold &&
            distance[next]! < distance[current]! &&
            value >= 0 &&
            slidePeaks[edge]! <= limit &&
            isUsableMove(current, next)
          ) {
            best = Math.min(best, value);
          }
        }
        if (best !== unreached) {
          (advancesByValue[best] ??= []).push(keyOf(current, false, slot));
        }
      }
    }
    let pending = starts.flatMap((index) =>
      [false, true].flatMap((afterDaughterMove) =>
        Array.from({ length: detourSlotCount }, (_, slot) =>
          keyOf(index, afterDaughterMove, slot),
        ),
      ),
    );
    for (
      let bound = 0;
      pending.length > 0 && bound < advancesByValue.length;
      bound += 1
    ) {
      const queue: number[] = [];
      for (const state of advancesByValue[bound] ?? []) {
        if (stepsToAdvance[state] !== 0) {
          stepsToAdvance[state] = 0;
          queue.push(state);
        }
      }
      for (let head = 0; head < queue.length; head += 1) {
        const state = queue[head]!;
        const slot = state % detourSlotCount;
        const pair = Math.floor(state / detourSlotCount);
        const current = pair >> 1;
        const arrivedByDaughterMove = (pair & 1) === 1;
        const steps = stepsToAdvance[state]! + 1;
        for (
          let edge = edgeStarts[current]!;
          edge < edgeStarts[current + 1]!;
          edge += 1
        ) {
          const previous = edges[edge]!;
          const previousDistance = distance[previous]!;
          // 娘の手で `current` へ来た状態は娘の手の辺からだけ、そうでない状態は娘を動かさない辺からだけ来られる。
          const movesDaughter = slidePeaks[edge]! >= 0;
          if (
            movesDaughter !== arrivedByDaughterMove ||
            previousDistance > limit ||
            optimal[previous]! <= 0 ||
            slidePeaks[edge]! > limit ||
            !isUsableMove(previous, current)
          ) {
            continue;
          }
          // `previous` から `current` へ娘を遠ざける手は、遠回りの残りを1つ使う。
          let previousSlot = slot;
          if (slot !== unlimitedDetourSlot) {
            previousSlot += distance[current]! > previousDistance ? 1 : 0;
            if (previousSlot > maximumCountedDetour) {
              continue;
            }
          }
          // 娘の手の前は娘の手で来ていない状態だけ。娘を動かさない手の前は、どちらで来ていてもよい。
          for (const previousAfterDaughterMove of movesDaughter
            ? [false]
            : [false, true]) {
            const previousState = keyOf(
              previous,
              previousAfterDaughterMove,
              previousSlot,
            );
            if (steps < stepsToAdvance[previousState]!) {
              stepsToAdvance[previousState] = steps;
              queue.push(previousState);
            }
          }
        }
      }
      pending = pending.filter((pair) => {
        if (stepsToAdvance[pair]! <= bound) {
          values[pair] = bound;
          return false;
        }
        return true;
      });
    }
    // 起点を足し終えた後は手の数が減らないので、残った組の値は前進までの手の数（前進できなければ -1 のまま）。
    for (const pair of pending) {
      const steps = stepsToAdvance[pair]!;
      if (steps !== unreached) {
        values[pair] = steps;
      }
    }
  };

  const boardsAt = (target: number) =>
    boards.flatMap((_, index) =>
      optimal[index]! > 0 && distance[index] === target ? [index] : [],
    );
  // 前進した後の区間は、前進した距離が上限としきい値。距離は始めの距離（4 以下）を下回るので 3 まで。
  for (let reached = 1; reached < maximumDaughterDistance; reached += 1) {
    measureSegment(reached, reached, boardsAt(reached), afterAdvance);
  }
  // 始めの区間は、上限が最大の距離、しきい値が始めの盤面の距離。
  for (let start = 1; start <= maximumDaughterDistance; start += 1) {
    measureSegment(
      maximumDaughterDistance,
      start,
      boardsAt(start),
      preparationBySlot,
    );
  }
  const preparation = new Int32Array(count);
  const detour = new Int32Array(count);
  for (let index = 0; index < count; index += 1) {
    if (optimal[index] === 0) {
      preparation[index] = 0;
      detour[index] = 0;
      continue;
    }
    // 始めの盤面の前に手は無いので、直前の手が娘の手でない側を引く。
    const unlimited =
      preparationBySlot[keyOf(index, false, unlimitedDetourSlot)]!;
    preparation[index] = unlimited;
    let slot = 0;
    while (
      slot < unlimitedDetourSlot &&
      preparationBySlot[keyOf(index, false, slot)] !== unlimited
    ) {
      slot += 1;
    }
    detour[index] = unlimited < 0 ? -1 : slot;
  }
  return { preparation, detour, afterAdvance, detourSlotCount };
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

  const slidePeaks = measureDaughterSlidePeaks(graph, daughterCell);
  const { preparation, detour, afterAdvance, detourSlotCount } =
    measurePreparationAndDetour(graph, distance, slidePeaks, optimal, {
      maximumCountedDetour: HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT,
      shortestOnly: false,
    });
  const measures: HakoiriMusumeStateMeasures = {
    optimal,
    preparationTrace: { distance, slidePeaks, afterAdvance, detourSlotCount },
    preparation,
    detour,
    shortestPreparation: measurePreparationAndDetour(
      graph,
      distance,
      slidePeaks,
      optimal,
      { maximumCountedDetour: -1, shortestOnly: true },
    ).preparation,
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
