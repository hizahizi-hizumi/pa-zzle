import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import {
  createHakoiriMusumeProblemIdentity,
  type HAKOIRI_MUSUME_GENERATOR_VERSION,
  type HakoiriMusumeIdentifiedProblem,
  type HakoiriMusumeProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import problemPoolJson from "@/games/hakoiri-musume/problem/problem-pool.json";
import {
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  HAKOIRI_MUSUME_CELL_COUNT,
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
  type HakoiriMusumePiece,
  type HakoiriMusumePieceKind,
  listHakoiriMusumePieceCells,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/**
 * 問題集の1問。
 * - `board`: 始めたときの盤面の20文字。問題の identity の `seed` で、生成器を走らせずに問題を復元できる。
 * - `optimalMoveCount`: 娘を出口の前へ運ぶ最短手数（同じ駒を続けて動かした移動を1手と数える）。評価の基準に使う。
 * - `preparationLength`: 準備の長さ（難易度の分析と同じ量）。速さの基準時間に使う。
 * - `daughterDetourCount`・`shortestPreparationLength`: 娘の遠回りと、最短の解だけで数えた準備の長さ。検証情報に出す。
 *   持たない項目もある。
 */
export type HakoiriMusumeProblemPoolEntry = readonly [
  board: string,
  optimalMoveCount: number,
  preparationLength: number,
  daughterDetourCount?: number,
  shortestPreparationLength?: number,
];

export type HakoiriMusumeProblemPool = {
  generatorVersion: typeof HAKOIRI_MUSUME_GENERATOR_VERSION;
  levels: Record<
    HakoiriMusumeDifficulty,
    readonly HakoiriMusumeProblemPoolEntry[]
  >;
};

/**
 * 問題の作業の量。評価の基準に使い、問題集と記録の事実に残るので、問題集から外れた記録でも評価し直せる。
 * - `optimalMoveCount`: 娘を出口の前へ運ぶ最短手数。
 * - `preparationLength`: 準備の長さ（難易度の分析と同じ量）。
 */
export type HakoiriMusumeWorkload = {
  optimalMoveCount: number;
  preparationLength: number;
};

/** 問題集の1項目を読み解いた値。問題は identity から復元する。 */
type HakoiriMusumeDecodedPoolEntry = {
  identity: HakoiriMusumeProblemIdentity;
  workload: HakoiriMusumeWorkload;
};

/** 問題集から復元した1問。評価の基準になる作業の量を伴う。 */
export type HakoiriMusumePooledProblem = HakoiriMusumeIdentifiedProblem & {
  workload: HakoiriMusumeWorkload;
};

const problemPool = problemPoolJson as unknown as HakoiriMusumeProblemPool;

export function decodeHakoiriMusumePoolEntry([
  board,
  optimalMoveCount,
  preparationLength,
]: HakoiriMusumeProblemPoolEntry): HakoiriMusumeDecodedPoolEntry {
  return {
    identity: createHakoiriMusumeProblemIdentity(board),
    workload: { optimalMoveCount, preparationLength },
  };
}

/** 問題集の1項目から問題を復元する。 */
export function restoreHakoiriMusumePoolEntry(
  entry: HakoiriMusumeProblemPoolEntry,
): HakoiriMusumePooledProblem {
  const { identity, workload } = decodeHakoiriMusumePoolEntry(entry);
  return { ...restoreHakoiriMusumeProblem(identity), workload };
}

export function listHakoiriMusumePoolEntries(
  difficulty: HakoiriMusumeDifficulty,
): readonly HakoiriMusumeProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  (entry) => decodeHakoiriMusumePoolEntry(entry).identity,
);

/** 難易度の問題集の全問の問題 ID を、問題集の並び順で返す。 */
export function listHakoiriMusumePoolProblemIds(
  difficulty: HakoiriMusumeDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 盤面 `board` を収めた難易度。どの難易度の問題集にも無ければ `null`。 */
export function findHakoiriMusumePoolDifficulty(
  board: string,
): HakoiriMusumeDifficulty | null {
  return poolEntriesByBoard().get(board)?.difficulty ?? null;
}

/** 盤面 `board` の問題集の1問。どの難易度の問題集にも無ければ `null`。 */
export function findHakoiriMusumePoolEntryByBoard(
  board: string,
): HakoiriMusumeProblemPoolEntry | null {
  return poolEntriesByBoard().get(board)?.entry ?? null;
}

type PooledBoard = {
  difficulty: HakoiriMusumeDifficulty;
  entry: HakoiriMusumeProblemPoolEntry;
};

let pooledBoards: Map<string, PooledBoard> | null = null;

function poolEntriesByBoard(): Map<string, PooledBoard> {
  pooledBoards ??= new Map(
    (
      Object.entries(problemPool.levels) as [
        HakoiriMusumeDifficulty,
        readonly HakoiriMusumeProblemPoolEntry[],
      ][]
    ).flatMap(([difficulty, entries]) =>
      entries.map((entry) => [entry[0], { difficulty, entry }] as const),
    ),
  );
  return pooledBoards;
}

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHakoiriMusumePoolEntryByProblemId(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumeProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

/**
 * 始めたときの盤面を見れば分かる、問題の特徴。
 * - `horizontalCount`: 横長の駒の数。
 * - `verticalCount`: 縦長の駒の数。横長と小駒と空きから決まる数なので絞り込みの軸にはせず、詳しい表示にだけ添える。
 * - `smallCount`: 小駒の数。
 * - `emptyCellCount`: 空きマスの数。駒の組から決まる数なので絞り込みの軸にはせず、詳しい表示にだけ添える。
 * - `emptyGroupCount`: 空きマスのまとまりの数。上下左右でつながった空きを1か所と数える。空きが1か所にまとまっていれば
 *   大きな駒を動かしやすく、ばらけていれば小さな駒で空きを寄せる手から始まる。
 */
export type HakoiriMusumeProblemFeatures = {
  horizontalCount: number;
  verticalCount: number;
  smallCount: number;
  emptyCellCount: number;
  emptyGroupCount: number;
};

/** 空きマスのまとまりの数。上下左右でつながった空きを1つと数える。 */
function countEmptyGroups(pieces: readonly HakoiriMusumePiece[]): number {
  const occupied = new Set(pieces.flatMap(listHakoiriMusumePieceCells));
  const seen = new Set<number>();
  let groups = 0;
  for (let cell = 0; cell < HAKOIRI_MUSUME_CELL_COUNT; cell += 1) {
    if (occupied.has(cell) || seen.has(cell)) {
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
        if (
          nextRow < 0 ||
          nextRow >= HAKOIRI_MUSUME_ROWS ||
          nextColumn < 0 ||
          nextColumn >= HAKOIRI_MUSUME_COLUMNS
        ) {
          continue;
        }
        const next = getHakoiriMusumeCell({ row: nextRow, column: nextColumn });
        if (!occupied.has(next) && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
  }
  return groups;
}

/** 始めたときの盤面から問題の特徴を求める。 */
export function measureHakoiriMusumeProblemFeatures(
  pieces: readonly HakoiriMusumePiece[],
): HakoiriMusumeProblemFeatures {
  function countKind(kind: HakoiriMusumePieceKind): number {
    return pieces.filter((piece) => piece.kind === kind).length;
  }
  return {
    horizontalCount: countKind("horizontal"),
    verticalCount: countKind("vertical"),
    smallCount: countKind("small"),
    emptyCellCount:
      HAKOIRI_MUSUME_CELL_COUNT -
      pieces.flatMap(listHakoiriMusumePieceCells).length,
    emptyGroupCount: countEmptyGroups(pieces),
  };
}

/** 難易度の問題集の1問の特徴を、問題集の盤面の20文字から求める。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHakoiriMusumePoolProblemFeatures(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumeProblemFeatures | null {
  const entry = findHakoiriMusumePoolEntryByProblemId(difficulty, problemId);
  const pieces = entry ? parseHakoiriMusumeBoard(entry[0]) : null;
  return pieces ? measureHakoiriMusumeProblemFeatures(pieces) : null;
}

/** 図鑑の絞り込みで問題を分ける特徴の軸。最短手数は解かないと分からないので軸にしない。 */
export const hakoiriMusumeProblemFeatureAxes = [
  {
    id: "horizontal-count",
    getValue({ horizontalCount }) {
      return createCountFeatureValue(horizontalCount);
    },
  },
  {
    id: "small-count",
    getValue({ smallCount }) {
      return createCountFeatureValue(smallCount);
    },
  },
  {
    id: "empty-group-count",
    getValue({ emptyGroupCount }) {
      return createCountFeatureValue(emptyGroupCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<HakoiriMusumeProblemFeatures>[];

export type HakoiriMusumeProblemFeatureAxisId =
  (typeof hakoiriMusumeProblemFeatureAxes)[number]["id"];
