import {
  classifyHakoiriMusumeFeatures,
  type HakoiriMusumeDifficulty,
  type HakoiriMusumeDifficultyAssessment,
} from "@/games/hakoiri-musume/difficulty";
import {
  type HakoiriMusumeDifficultyFeatures,
  readHakoiriMusumeDifficultyFeatures,
} from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  findHakoiriMusumeSimplePreparationPath,
  keepsHakoiriMusumePreparationWhenMerged,
} from "@/games/hakoiri-musume/problem/generation/simple-witness";
import {
  countHakoiriMusumePieceSetEmptyCells,
  createHakoiriMusumeStateGraph,
  enumerateHakoiriMusumePieceSetBoards,
  type HakoiriMusumeBoardText,
  type HakoiriMusumePieceSet,
  type HakoiriMusumeStateGraph,
  type HakoiriMusumeStateMeasures,
  measureHakoiriMusumeStateGraph,
  mirrorHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/problem/generation/state-space";
import {
  getHakoiriMusumeCellPosition,
  HAKOIRI_MUSUME_CELL_COUNT,
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
} from "@/games/hakoiri-musume/puzzle/board";
import { hashProblemSeed } from "@/games/problem-seed";

/**
 * 候補空間の駒の組。空き（16 − 2 ×（縦長 + 横長）− 小駒）と長い駒の数・小駒の数の形ごとに、縦長と横長の分け方をすべて入れる。
 * 空き2〜6 の 15 の形で 82 組。空きが7以上の組は、レベル1 の空きの上限（6）を超えて出さないので入れない。
 * 空き2・3 は、近い問題を除いて、形の全組の合計でレベル5 を採れるか、レベル3 かレベル4 を百問以上採れる形を入れる。
 * 長い駒7本（小駒0）は最短8手以上の局面が無い。小駒をさらに増やした形（空き2 で小駒12以上、空き3 で小駒9以上）は
 * レベル5 が無く、レベル3・4 も合計で数十問しか採れない。空き4〜6 で小駒を増やした形はレベル1・2 しか出ず、そのレベルは
 * 今の形で足りる（`箱入り娘難易度.md` §6）。
 */
const pieceSetShapes = [
  { empty: 2, long: 5, small: 4 },
  { empty: 2, long: 6, small: 2 },
  { empty: 2, long: 4, small: 6 },
  { empty: 2, long: 3, small: 8 },
  { empty: 2, long: 2, small: 10 },
  { empty: 3, long: 5, small: 3 },
  { empty: 3, long: 6, small: 1 },
  { empty: 3, long: 4, small: 5 },
  { empty: 3, long: 3, small: 7 },
  { empty: 4, long: 5, small: 2 },
  { empty: 4, long: 4, small: 4 },
  { empty: 4, long: 6, small: 0 },
  { empty: 5, long: 5, small: 1 },
  { empty: 6, long: 5, small: 0 },
  { empty: 6, long: 4, small: 2 },
] as const;

export const hakoiriMusumePieceSets: readonly HakoiriMusumePieceSet[] =
  pieceSetShapes.flatMap(({ long, small }) =>
    Array.from({ length: long + 1 }, (_, vertical) => ({
      vertical,
      horizontal: long - vertical,
      small,
    })),
  );

export function formatHakoiriMusumePieceSet({
  vertical,
  horizontal,
  small,
}: HakoiriMusumePieceSet): string {
  return `v${vertical}h${horizontal}s${small}`;
}

/**
 * 近い問題とみなす手数。同じレベルで、この手数以内で行き来できる2問は片方だけを採る。違うレベルでも、上のレベルの問題から
 * この手数以内の盤面は下のレベルに採らない。
 */
export const HAKOIRI_MUSUME_NEAR_MOVE_COUNT = 4;

/** 駒の組の全局面と、その特徴。`components` は盤面ごとの、1手ずつ行き来できる盤面の集まり（連結成分）の番号。 */
export type HakoiriMusumePieceSetSpace = {
  graph: HakoiriMusumeStateGraph;
  measures: HakoiriMusumeStateMeasures;
  emptyCellCount: number;
  components: Int32Array;
};

/** 盤面ごとの連結成分の番号。手はどれも1手で戻せるので、辺の向きを問わずにたどる。 */
function labelHakoiriMusumeComponents({
  boards,
  edgeStarts,
  edges,
}: HakoiriMusumeStateGraph): Int32Array {
  const components = new Int32Array(boards.length).fill(-1);
  let label = 0;
  for (let first = 0; first < boards.length; first += 1) {
    if (components[first] !== -1) {
      continue;
    }
    components[first] = label;
    const stack = [first];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        if (components[next] === -1) {
          components[next] = label;
          stack.push(next);
        }
      }
    }
    label += 1;
  }
  return components;
}

export function analyzeHakoiriMusumePieceSet(
  pieceSet: HakoiriMusumePieceSet,
): HakoiriMusumePieceSetSpace {
  const graph = createHakoiriMusumeStateGraph(
    enumerateHakoiriMusumePieceSetBoards(pieceSet),
  );
  return {
    graph,
    measures: measureHakoiriMusumeStateGraph(graph),
    emptyCellCount: countHakoiriMusumePieceSetEmptyCells(pieceSet),
    components: labelHakoiriMusumeComponents(graph),
  };
}

/**
 * seed と盤面から決める、候補を見る順の鍵。調査コードと同じ順にするため、言語に依らない文字列の hash（`hashProblemSeed`）で決める。
 */
export function rankHakoiriMusumeCandidate(
  seed: string,
  board: HakoiriMusumeBoardText,
): number {
  return hashProblemSeed(`${seed}:${board}`);
}

/**
 * 左右反転の組から問題に採る向き。文字列の小さい方に決めると、娘や駒の寄り方が片方の向きにそろうので、seed と組から決める。
 */
export function chooseHakoiriMusumeOrientation(
  seed: string,
  board: HakoiriMusumeBoardText,
): HakoiriMusumeBoardText {
  const mirrored = mirrorHakoiriMusumeBoard(board);
  const [first, second] =
    board < mirrored ? [board, mirrored] : [mirrored, board];
  return hashProblemSeed(`${seed}:orientation:${first}`) % 2 === 0
    ? first
    : second;
}

/** 1つの候補（左右反転の組の代表）と、その特徴と分類。 */
export type HakoiriMusumeCandidate = {
  index: number;
  board: HakoiriMusumeBoardText;
  features: HakoiriMusumeDifficultyFeatures;
  assessment: HakoiriMusumeDifficultyAssessment;
};

/**
 * 駒の組の候補を全部分類する。候補は娘を出口の前へ運べてまだ着いていない局面で、左右反転の組は `seed` で選んだ向きを代表にする。
 */
export function listHakoiriMusumeCandidates(
  { graph, measures, emptyCellCount }: HakoiriMusumePieceSetSpace,
  seed: string,
): HakoiriMusumeCandidate[] {
  const candidates: HakoiriMusumeCandidate[] = [];
  graph.boards.forEach((board, index) => {
    if (
      measures.optimal[index]! <= 0 ||
      chooseHakoiriMusumeOrientation(seed, board) !== board
    ) {
      return;
    }
    const features = readHakoiriMusumeDifficultyFeatures(
      measures,
      index,
      emptyCellCount,
    );
    candidates.push({
      index,
      board,
      features,
      assessment: classifyHakoiriMusumeFeatures(features),
    });
  });
  return candidates;
}

/**
 * 合流を近い問題とみなす割合。同じレベルの2問の最短解が同じ局面で合流し、そこから先の手数（共通の後半）が短い方の最短手数の
 * この割合以上なら、片方だけを採る。レベル5 を百五十問以上採れるよう、4分の3 にしている（半分にすると約百十問に減る）。
 * 終わり方の偏りは、同じ最終局面の上限（`hakoiriMusumeLevelSelections` の `finalPositionLimit`）で抑える。
 */
export const HAKOIRI_MUSUME_MERGE_SHARE = 0.75;

const noOwner = 2 ** 31 - 1;

/**
 * 近い問題を除く印。採った問題について、`HAKOIRI_MUSUME_NEAR_MOVE_COUNT` 手以内で行ける局面と、採った問題を最短解の上に持つ
 * 局面（最短の祖先）に印を付け、採った問題の最短解の上にある局面（最短の子孫）には、そこを通る採った問題の最短手数の最小を残す。
 * 候補は、印の付いた局面か、最短解が採った問題の最短解と合流して共通の後半が `mergeShare` 以上になるなら近い問題とする。
 * 最短の子孫に入る候補は、共通の後半が候補の最短手数そのものなので、必ず近い問題になる。
 * 手数の探索は採った問題ごとに印に関わらずたどり、前に付けた印で止めない。左右を反転した盤面は同じ問題なので、採った問題の
 * 反転した盤面のまわりにも同じ印を付ける（候補の反転が採った問題に近いことと、候補が採った問題の反転に近いことは同じ）。
 */
export function createHakoiriMusumeNearProblemFilter(
  { graph, measures }: Pick<HakoiriMusumePieceSetSpace, "graph" | "measures">,
  mergeShare = HAKOIRI_MUSUME_MERGE_SHARE,
) {
  const { boards, indexByBoard, edgeStarts, edges } = graph;
  const { optimal } = measures;
  const near = new Uint8Array(boards.length);
  const ancestors = new Uint8Array(boards.length);
  const descendantOwner = new Int32Array(boards.length).fill(noOwner);
  let shortestTaken = noOwner;

  function markAncestors(start: number) {
    const stack = [start];
    ancestors[start] = 1;
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        // 祖先の印が付いた局面の先は、その局面に印を付けたときに全部印が付いている。
        if (!ancestors[next] && optimal[next] === optimal[current]! + 1) {
          ancestors[next] = 1;
          stack.push(next);
        }
      }
    }
  }

  function markDescendants(start: number) {
    const owner = optimal[start]!;
    const stack = [start];
    descendantOwner[start] = Math.min(descendantOwner[start]!, owner);
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        // 残した最短手数が今の問題以下の局面の先は、その値を残したときに今の問題以下になっている。
        if (
          optimal[next] === optimal[current]! - 1 &&
          descendantOwner[next]! > owner
        ) {
          descendantOwner[next] = owner;
          stack.push(next);
        }
      }
    }
  }

  function markNearMoves(start: number) {
    const reached = new Set([start]);
    let frontier = [start];
    near[start] = 1;
    for (let step = 0; step < HAKOIRI_MUSUME_NEAR_MOVE_COUNT; step += 1) {
      const next: number[] = [];
      for (const current of frontier) {
        for (
          let edge = edgeStarts[current]!;
          edge < edgeStarts[current + 1]!;
          edge += 1
        ) {
          const neighbor = edges[edge]!;
          if (!reached.has(neighbor)) {
            reached.add(neighbor);
            near[neighbor] = 1;
            next.push(neighbor);
          }
        }
      }
      frontier = next;
    }
  }

  /** `start` の最短解が採った問題の最短解と合流し、共通の後半が `mergeShare` 以上になるか。 */
  function mergesWithTaken(start: number): boolean {
    if (shortestTaken === noOwner) {
      return false;
    }
    const own = optimal[start]!;
    // 共通の後半は、合流する局面の最短手数。採った問題の最短手数の最小より短い所では割合に届かない。
    const shortestTail = mergeShare * Math.min(own, shortestTaken);
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const tail = optimal[current]!;
      if (
        descendantOwner[current] !== noOwner &&
        tail >= mergeShare * Math.min(own, descendantOwner[current]!)
      ) {
        return true;
      }
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        if (
          optimal[next] === tail - 1 &&
          tail - 1 >= shortestTail &&
          !seen.has(next)
        ) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return false;
  }

  return {
    /** 印の付いた局面か、採った問題と合流する局面なら近い問題。 */
    isNear(board: HakoiriMusumeBoardText): boolean {
      const index = indexByBoard.get(board)!;
      return (
        near[index] === 1 || ancestors[index] === 1 || mergesWithTaken(index)
      );
    },
    /**
     * 採った問題から `HAKOIRI_MUSUME_NEAR_MOVE_COUNT` 手以内か、採った問題と片方の最短解の上にもう片方の始めがある局面か
     * （合流は見ない）。上のレベルで採った問題に対して、下のレベルの候補を確かめるのに使う。
     */
    isNearOrOnShortestSolution(board: HakoiriMusumeBoardText): boolean {
      const index = indexByBoard.get(board)!;
      return (
        near[index] === 1 ||
        ancestors[index] === 1 ||
        descendantOwner[index] !== noOwner
      );
    },
    /** 採った問題と、その左右を反転した盤面のまわりに印を付ける。 */
    take(board: HakoiriMusumeBoardText) {
      for (const target of new Set([board, mirrorHakoiriMusumeBoard(board)])) {
        const start = indexByBoard.get(target)!;
        markNearMoves(start);
        markAncestors(start);
        markDescendants(start);
        shortestTaken = Math.min(shortestTaken, optimal[start]!);
      }
    },
  };
}

/**
 * 盤面から読める、問題の始めの姿。
 * - `daughterRow`・`daughterColumn`: 娘の左上の行と列。
 * - `smallCount`: 小駒の数。
 * - `tidiness`: 作られた初期配置らしさ。左右対称、空きが1か所にまとまる、縦長・横長・小駒がそろう、のそれぞれで 1。
 */
export type HakoiriMusumeStartShape = {
  daughterRow: number;
  daughterColumn: number;
  smallCount: number;
  tidiness: number;
};

function countEmptyGroups(board: HakoiriMusumeBoardText): number {
  const seen = new Set<number>();
  let groups = 0;
  for (let cell = 0; cell < HAKOIRI_MUSUME_CELL_COUNT; cell += 1) {
    if (board[cell] !== "." || seen.has(cell)) {
      continue;
    }
    groups += 1;
    const stack = [cell];
    seen.add(cell);
    while (stack.length > 0) {
      const { row, column } = getHakoiriMusumeCellPosition(stack.pop()!);
      for (const [nextRow, nextColumn] of [
        [row - 1, column],
        [row + 1, column],
        [row, column - 1],
        [row, column + 1],
      ] as const) {
        const next = nextRow * HAKOIRI_MUSUME_COLUMNS + nextColumn;
        if (
          nextRow >= 0 &&
          nextRow < HAKOIRI_MUSUME_ROWS &&
          nextColumn >= 0 &&
          nextColumn < HAKOIRI_MUSUME_COLUMNS &&
          board[next] === "." &&
          !seen.has(next)
        ) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
  }
  return groups;
}

export function readHakoiriMusumeStartShape(
  board: HakoiriMusumeBoardText,
): HakoiriMusumeStartShape {
  const { row, column } = getHakoiriMusumeCellPosition(board.indexOf("A"));
  const has = (character: string) => board.includes(character);
  return {
    daughterRow: row,
    daughterColumn: column,
    smallCount: [...board].filter((character) => character === "s").length,
    tidiness:
      (mirrorHakoiriMusumeBoard(board) === board ? 1 : 0) +
      (countEmptyGroups(board) === 1 ? 1 : 0) +
      (has("v") && has("h") && has("s") ? 1 : 0),
  };
}

/**
 * レベルごとの採り方。分類（帯）はそのままに、どの問題を問題集に入れるかを決める。
 * - `optimalMoveCount`: 採る最短手数の範囲。レベルの中で手数が大きくばらつかないよう、中央値のおよそ2倍で切る。
 *   レベル3 はレベル4 と手数が入れ替わらないよう 40 手まで、レベル4 はレベル5 の最短手数の中央値より短くする。
 *   レベル1 は、初めての1問が長くなりすぎないよう 18 手まで。
 * - `requiresTopDaughter`: 娘が上の2段から始まる問題だけを採る（作られた初期配置らしさ）。
 * - `prefersTopDaughter`: 娘が上の2段から始まる問題を先に採る。
 * - `componentLimit`: 1つの連結成分から採る数の上限。同じ成分の問題は解き筋が似やすい。レベル4 は、上のレベルに近い盤面を
 *   除いても四百問以上採れるよう 40。
 * - `prefersLong`: 最短手数の長い問題を先に採る（レベル5 の歯ごたえ）。
 * - `finalPositionLimit`: 同じ最終局面（娘が出口の前に着く1手前の盤面。左右反転は同じ局面）を最短解に持つ問題を採る数の上限。
 *   終わり方が同じ問題が続かないようにする。レベル4・5 は 10（5 にするとレベル5 が約百二十問に減る）。
 */
type LevelSelection = {
  optimalMoveCount: { minimum: number; maximum: number };
  requiresTopDaughter: boolean;
  prefersTopDaughter: boolean;
  componentLimit: number;
  prefersLong: boolean;
  finalPositionLimit: number;
};

/** どのレベルでも採る小駒の数の上限。小駒の多い盤は途中の局面に見え、駒を寄せるだけの手が増える。 */
export const HAKOIRI_MUSUME_MAXIMUM_SMALL_COUNT = 6;

/** 上の2段（行0〜1）。 */
const TOP_DAUGHTER_ROWS = 2;

/** レベル5 で先に採る最短手数の段。長い段から採る。 */
const LONG_PROBLEM_TIERS = [70, 55] as const;

export const hakoiriMusumeLevelSelections = {
  "1": {
    optimalMoveCount: { minimum: 8, maximum: 18 },
    requiresTopDaughter: false,
    prefersTopDaughter: true,
    componentLimit: 50,
    prefersLong: false,
    finalPositionLimit: Number.POSITIVE_INFINITY,
  },
  "2": {
    optimalMoveCount: { minimum: 8, maximum: 40 },
    requiresTopDaughter: false,
    prefersTopDaughter: true,
    componentLimit: 50,
    prefersLong: false,
    finalPositionLimit: Number.POSITIVE_INFINITY,
  },
  "3": {
    optimalMoveCount: { minimum: 8, maximum: 40 },
    requiresTopDaughter: false,
    prefersTopDaughter: true,
    componentLimit: 40,
    prefersLong: false,
    finalPositionLimit: Number.POSITIVE_INFINITY,
  },
  "4": {
    optimalMoveCount: { minimum: 8, maximum: 54 },
    requiresTopDaughter: true,
    prefersTopDaughter: true,
    componentLimit: 40,
    prefersLong: false,
    finalPositionLimit: 10,
  },
  "5": {
    optimalMoveCount: { minimum: 8, maximum: 90 },
    requiresTopDaughter: true,
    prefersTopDaughter: true,
    componentLimit: 25,
    prefersLong: true,
    finalPositionLimit: 10,
  },
} as const satisfies Record<HakoiriMusumeDifficulty, LevelSelection>;

/** レベルの採り方に合う候補か。合わない候補は問題集に入れない。 */
export function isHakoiriMusumeSelectable(
  difficulty: HakoiriMusumeDifficulty,
  { board, features }: Pick<HakoiriMusumeCandidate, "board" | "features">,
): boolean {
  const selection = hakoiriMusumeLevelSelections[difficulty];
  const shape = readHakoiriMusumeStartShape(board);
  const { optimalMoveCount, preparationLength, emptyCellCount } = features;
  // 空きが多く、娘を進められない手が無い盤は、適当に触っても出られる。
  const solvableByTouching = emptyCellCount >= 6 && preparationLength === 0;
  return (
    shape.smallCount <= HAKOIRI_MUSUME_MAXIMUM_SMALL_COUNT &&
    optimalMoveCount >= selection.optimalMoveCount.minimum &&
    optimalMoveCount <= selection.optimalMoveCount.maximum &&
    (!selection.requiresTopDaughter || shape.daughterRow < TOP_DAUGHTER_ROWS) &&
    !solvableByTouching
  );
}

/** 娘が始めの盤面で動けるか（どれかの向きの隣の2マスが空いているか）。 */
function canDaughterMoveAtStart(board: HakoiriMusumeBoardText): boolean {
  const { row, column } = getHakoiriMusumeCellPosition(board.indexOf("A"));
  const isEmpty = (cellRow: number, cellColumn: number) =>
    cellRow >= 0 &&
    cellRow < HAKOIRI_MUSUME_ROWS &&
    cellColumn >= 0 &&
    cellColumn < HAKOIRI_MUSUME_COLUMNS &&
    board[cellRow * HAKOIRI_MUSUME_COLUMNS + cellColumn] === ".";
  return (
    (isEmpty(row - 1, column) && isEmpty(row - 1, column + 1)) ||
    (isEmpty(row + 2, column) && isEmpty(row + 2, column + 1)) ||
    (isEmpty(row, column - 1) && isEmpty(row + 1, column - 1)) ||
    (isEmpty(row, column + 2) && isEmpty(row + 1, column + 2))
  );
}

/** 空きマスの行の平均が、この行より上なら空きが上の段、下の段の行（3）以上なら空きが下の段とみなす。 */
const HIGH_EMPTY_ROW = 2;
const LOW_EMPTY_ROW = 3;

/** 空きの高さの段。空きが下の段なら 0、上の段なら 2、ほかは 1。 */
function rankEmptyHeight(board: HakoiriMusumeBoardText): number {
  const rows = [...board].flatMap((character, cell) =>
    character === "." ? [Math.floor(cell / HAKOIRI_MUSUME_COLUMNS)] : [],
  );
  const averageRow = rows.reduce((sum, row) => sum + row, 0) / rows.length;
  if (averageRow >= LOW_EMPTY_ROW) {
    return 0;
  }
  return averageRow < HIGH_EMPTY_ROW ? 2 : 1;
}

/**
 * 採る順を決める段（小さいほど先）。次の順に重く見る。同じ段の中は `rankHakoiriMusumeCandidate` の順。
 * 1. 長い問題（レベル5）
 * 2. 娘が上の2段から始まる
 * 3. 娘が3段目の左右から始まらない
 * 4. 始めの盤面の手の少なさが無い（始めから娘が動ける・合法な初手が1つしかない、のそれぞれを1つと数える）
 * 5. 空きが下の段にある（上の段の空きは、駒を落としていく手から始まり、作られた初期配置に見えにくい）
 * 6. 整っている
 */
export function rankHakoiriMusumeCandidateTiers(
  difficulty: HakoiriMusumeDifficulty,
  { board, features }: Pick<HakoiriMusumeCandidate, "board" | "features">,
): number[] {
  const selection = hakoiriMusumeLevelSelections[difficulty];
  const shape = readHakoiriMusumeStartShape(board);
  const lengthTier = selection.prefersLong
    ? LONG_PROBLEM_TIERS.filter(
        (minimum) => features.optimalMoveCount < minimum,
      ).length
    : 0;
  const lowDaughter =
    selection.prefersTopDaughter && shape.daughterRow >= TOP_DAUGHTER_ROWS
      ? 1
      : 0;
  const sideOfThirdRow =
    shape.daughterRow === 2 && shape.daughterColumn !== 1 ? 1 : 0;
  const plainStart =
    (canDaughterMoveAtStart(board) ? 1 : 0) +
    (features.firstMoveCount === 1 ? 1 : 0);
  return [
    lengthTier,
    lowDaughter,
    sideOfThirdRow,
    plainStart,
    rankEmptyHeight(board),
    3 - shape.tidiness,
  ];
}

function compareTiers(left: readonly number[], right: readonly number[]) {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

/** 盤面 `start` の最短解の上にある、最終局面（娘が出口の前に着く1手前の盤面）。左右反転は小さい方の番号にまとめる。 */
function listFinalPositions(
  { graph, measures }: Pick<HakoiriMusumePieceSetSpace, "graph" | "measures">,
  start: number,
): number[] {
  const { boards, indexByBoard, edgeStarts, edges } = graph;
  const { optimal } = measures;
  const seen = new Set([start]);
  const stack = [start];
  const finals = new Set<number>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (optimal[current] === 1) {
      const mirrored = indexByBoard.get(
        mirrorHakoiriMusumeBoard(boards[current]!),
      )!;
      finals.add(Math.min(current, mirrored));
      continue;
    }
    for (
      let edge = edgeStarts[current]!;
      edge < edgeStarts[current + 1]!;
      edge += 1
    ) {
      const next = edges[edge]!;
      if (optimal[next] === optimal[current]! - 1 && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return [...finals];
}

/** 問題を採るレベルの順。上のレベルから採り、上のレベルの問題に近い盤面を下のレベルに採らない。 */
const pickingOrder = ["5", "4", "3", "2", "1"] as const;

/**
 * 駒の組から、レベルごとに問題を採る。上のレベルから順に、レベルの採り方（`hakoiriMusumeLevelSelections`）に合う候補を、段の順、
 * 同じ段は `rankHakoiriMusumeCandidate` の小さい順（同じなら盤面の文字列の順）に見て、次をすべて満たすものを採る。
 * - 同じレベルの近い問題でない（`createHakoiriMusumeNearProblemFilter`）。
 * - 上のレベルで採った問題（左右反転を含む）から `HAKOIRI_MUSUME_NEAR_MOVE_COUNT` 手以内でなく、その最短解の上になく、
 *   自分の最短解の上にその問題の始めが無い。
 * - 連結成分の上限と、同じ最終局面の上限に達していない。
 * - 準備の長さと遠回りを、同じ盤面を2度通らない解で確かめられ、その解の、ほかの駒の手と入れ替えて1手にまとめられる娘の手を
 *   まとめても値が変わらない（`keepsHakoiriMusumePreparationWhenMerged`）。
 * レベルごとに `limit` 問で止める。`witnessRejections` は、輪の無い解を確かめられずに採らなかった数。
 */
export function pickHakoiriMusumePieceSetProblems(
  space: HakoiriMusumePieceSetSpace,
  candidates: readonly HakoiriMusumeCandidate[],
  seed: string,
  limit: number,
): {
  picked: Record<HakoiriMusumeDifficulty, HakoiriMusumeCandidate[]>;
  witnessRejections: Record<HakoiriMusumeDifficulty, number>;
} {
  const picked: Record<HakoiriMusumeDifficulty, HakoiriMusumeCandidate[]> = {
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
  };
  const witnessRejections: Record<HakoiriMusumeDifficulty, number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
  const upperLevels = createHakoiriMusumeNearProblemFilter(space);
  for (const difficulty of pickingOrder) {
    const levelCandidates = candidates
      .filter(
        (candidate) =>
          candidate.assessment.status === "classified" &&
          candidate.assessment.difficulty === difficulty &&
          isHakoiriMusumeSelectable(difficulty, candidate),
      )
      .map((candidate) => ({
        candidate,
        tiers: rankHakoiriMusumeCandidateTiers(difficulty, candidate),
        rank: rankHakoiriMusumeCandidate(seed, candidate.board),
      }))
      .sort(
        (left, right) =>
          compareTiers(left.tiers, right.tiers) ||
          left.rank - right.rank ||
          (left.candidate.board < right.candidate.board ? -1 : 1),
      );
    const { componentLimit, finalPositionLimit } =
      hakoiriMusumeLevelSelections[difficulty];
    const filter = createHakoiriMusumeNearProblemFilter(space);
    const takenByComponent = new Map<number, number>();
    const takenByFinalPosition = new Map<number, number>();
    const taken: HakoiriMusumeBoardText[] = [];
    for (const { candidate } of levelCandidates) {
      if (picked[difficulty].length >= limit) {
        break;
      }
      const component = space.components[candidate.index]!;
      const takenInComponent = takenByComponent.get(component) ?? 0;
      if (
        takenInComponent >= componentLimit ||
        upperLevels.isNearOrOnShortestSolution(candidate.board) ||
        filter.isNear(candidate.board)
      ) {
        continue;
      }
      const finalPositions = Number.isFinite(finalPositionLimit)
        ? listFinalPositions(space, candidate.index)
        : [];
      if (
        finalPositions.some(
          (position) =>
            (takenByFinalPosition.get(position) ?? 0) >= finalPositionLimit,
        )
      ) {
        continue;
      }
      const witness = findHakoiriMusumeSimplePreparationPath(
        space.graph,
        space.measures,
        candidate.index,
        candidate.features.preparationLength,
        candidate.features.daughterDetourCount,
      );
      if (
        !witness ||
        !keepsHakoiriMusumePreparationWhenMerged(
          witness.map((board) => space.graph.boards[board]!),
        )
      ) {
        witnessRejections[difficulty] += 1;
        continue;
      }
      filter.take(candidate.board);
      takenByComponent.set(component, takenInComponent + 1);
      for (const position of finalPositions) {
        takenByFinalPosition.set(
          position,
          (takenByFinalPosition.get(position) ?? 0) + 1,
        );
      }
      taken.push(candidate.board);
      picked[difficulty].push(candidate);
    }
    // 下のレベルを採るときに、このレベルで採った問題に近い盤面を避ける。
    for (const board of taken) {
      upperLevels.take(board);
    }
  }
  return { picked, witnessRejections };
}

/**
 * 駒の組ごとに採った問題を、駒の組を seed で並べ替えた順に1問ずつ巡回して並べ、`count` 問で止める。
 * 採り尽くした駒の組は飛ばす。図鑑の番号から手数の長短が透けないよう、最短手数の順にはしない。
 */
export function interleaveHakoiriMusumeProblems<Problem>(
  pickedBySet: readonly (readonly Problem[])[],
  count: number,
): Problem[] {
  const result: Problem[] = [];
  for (let round = 0; result.length < count; round += 1) {
    const roundProblems = pickedBySet.flatMap((problems) =>
      round < problems.length ? [problems[round]!] : [],
    );
    if (roundProblems.length === 0) {
      break;
    }
    result.push(...roundProblems.slice(0, count - result.length));
  }
  return result;
}

/**
 * 段取りの長さ。最短解の上で娘を動かさない手が続く数の最長を、最短解の中で最も小さくなる解で数える（どの最短解でも、少なくとも
 * この数だけ娘に触れずに駒を組み替える）。採り方の重みにはせず、問題集の分布を確かめるのに使う。
 */
export function measureHakoiriMusumeSetupRun(
  { graph, measures }: Pick<HakoiriMusumePieceSetSpace, "graph" | "measures">,
  start: number,
): number {
  const { boards, edgeStarts, edges } = graph;
  const { optimal } = measures;
  const daughterOf = (index: number) => boards[index]!.indexOf("A");
  const reachesGoalWithin = (bound: number) => {
    const seen = new Set<number>([start * (bound + 1)]);
    const stack: [number, number][] = [[start, 0]];
    while (stack.length > 0) {
      const [current, run] = stack.pop()!;
      if (optimal[current] === 0) {
        return true;
      }
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        if (optimal[next] !== optimal[current]! - 1) {
          continue;
        }
        const nextRun = daughterOf(next) === daughterOf(current) ? run + 1 : 0;
        const key = next * (bound + 1) + nextRun;
        if (nextRun <= bound && !seen.has(key)) {
          seen.add(key);
          stack.push([next, nextRun]);
        }
      }
    }
    return false;
  };
  let bound = 0;
  while (!reachesGoalWithin(bound)) {
    bound += 1;
  }
  return bound;
}
