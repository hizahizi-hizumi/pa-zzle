import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { countHakoiriMusumeProblemEmptyCells } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  createHakoiriMusumeProblemIdentity,
  type HAKOIRI_MUSUME_GENERATOR_VERSION,
  type HakoiriMusumeIdentifiedProblem,
  type HakoiriMusumeProblem,
  type HakoiriMusumeProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import problemPoolJson from "@/games/hakoiri-musume/problem/problem-pool.json";
import {
  countHakoiriMusumeCells,
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  type HakoiriMusumeExitSide,
  type HakoiriMusumePieceKind,
  listHakoiriMusumePieceCells,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  createBoardSizeFeatureValue,
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/**
 * - `board`: 問題の identity の `seed`（`formatHakoiriMusumeProblemSeed`）。
 * - `daughterDetourCount`・`shortestPreparationLength`: 検証情報に出す。持たない項目もある。
 * - `family`: 画面には出さない。並びから外した前の問題集の問題には無い。
 */
export type HakoiriMusumeProblemPoolEntry = readonly [
  board: string,
  optimalMoveCount: number,
  preparationLength: number,
  daughterDetourCount?: number,
  shortestPreparationLength?: number,
  family?: string,
];

/** `retired` は前の問題集にあって今は並びから外した問題で、問題 ID でだけ引ける。 */
export type HakoiriMusumeProblemPool = {
  generatorVersion: typeof HAKOIRI_MUSUME_GENERATOR_VERSION;
  levels: Record<
    HakoiriMusumeDifficulty,
    readonly HakoiriMusumeProblemPoolEntry[]
  >;
  retired: Record<
    HakoiriMusumeDifficulty,
    readonly HakoiriMusumeProblemPoolEntry[]
  >;
};

/** 記録の事実にも残すので、問題集から外れた記録でも評価し直せる。 */
export type HakoiriMusumeWorkload = {
  optimalMoveCount: number;
  preparationLength: number;
};

type HakoiriMusumeDecodedPoolEntry = {
  identity: HakoiriMusumeProblemIdentity;
  workload: HakoiriMusumeWorkload;
};

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

const retiredIndex = createProblemPoolIndex(
  problemPool.retired,
  (entry) => decodeHakoiriMusumePoolEntry(entry).identity,
);

/** 問題 ID を、問題集の並び順で返す。 */
export function listHakoiriMusumePoolProblemIds(
  difficulty: HakoiriMusumeDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 並びから外した問題も含めて探す。 */
export function findHakoiriMusumePoolDifficulty(
  board: string,
): HakoiriMusumeDifficulty | null {
  return poolEntriesByBoard().get(board)?.difficulty ?? null;
}

/** 並びから外した問題も含めて探す。 */
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
    [problemPool.retired, problemPool.levels].flatMap((levels) =>
      (
        Object.entries(levels) as [
          HakoiriMusumeDifficulty,
          readonly HakoiriMusumeProblemPoolEntry[],
        ][]
      ).flatMap(([difficulty, entries]) =>
        entries.map((entry) => [entry[0], { difficulty, entry }] as const),
      ),
    ),
  );
  return pooledBoards;
}

/** 並びから外した問題も引ける。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHakoiriMusumePoolEntryByProblemId(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumeProblemPoolEntry | null {
  return (
    poolIndex.findPositionById(difficulty, problemId)?.entry ??
    retiredIndex.findPositionById(difficulty, problemId)?.entry ??
    null
  );
}

/**
 * - `exitWidth`: 1人目の娘の出口の幅。
 * - `horizontalCount`・`verticalCount`・`smallCount`・`squareCount`: 娘でない駒だけを数える。
 * - `emptyCellCount`: 壁は入れない。
 */
export type HakoiriMusumeProblemFeatures = {
  rows: number;
  columns: number;
  targetCount: number;
  bendCount: number;
  wallCount: number;
  exitWidth: number;
  exits: readonly { side: HakoiriMusumeExitSide; width: number }[];
  horizontalCount: number;
  verticalCount: number;
  smallCount: number;
  squareCount: number;
  emptyCellCount: number;
  emptyGroupCount: number;
};

/** 上下左右でつながった空きを1つと数える。 */
function countEmptyGroups({ layout, pieces }: HakoiriMusumeProblem): number {
  const occupied = new Set([
    ...layout.walls,
    ...pieces.flatMap((piece) => listHakoiriMusumePieceCells(layout, piece)),
  ]);
  const seen = new Set<number>();
  let groups = 0;
  for (let cell = 0; cell < countHakoiriMusumeCells(layout); cell += 1) {
    if (occupied.has(cell) || seen.has(cell)) {
      continue;
    }
    groups += 1;
    const stack = [cell];
    seen.add(cell);
    while (stack.length > 0) {
      const { row, column } = getHakoiriMusumeCellPosition(
        layout,
        stack.pop()!,
      );
      for (const [nextRow, nextColumn] of [
        [row - 1, column],
        [row + 1, column],
        [row, column - 1],
        [row, column + 1],
      ] as const) {
        if (
          nextRow < 0 ||
          nextRow >= layout.rows ||
          nextColumn < 0 ||
          nextColumn >= layout.columns
        ) {
          continue;
        }
        const next = getHakoiriMusumeCell(layout, {
          row: nextRow,
          column: nextColumn,
        });
        if (!occupied.has(next) && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
  }
  return groups;
}

export function measureHakoiriMusumeProblemFeatures(
  problem: HakoiriMusumeProblem,
): HakoiriMusumeProblemFeatures {
  const { layout, pieces } = problem;
  const others = pieces.filter((piece) => piece.target === null);
  const countKind = (kind: HakoiriMusumePieceKind) =>
    others.filter((piece) => piece.kind === kind).length;
  const exits = layout.goals.map((goal) => ({
    side: goal.exitSide,
    width: goal.exitCells.length,
  }));
  return {
    rows: layout.rows,
    columns: layout.columns,
    targetCount: layout.goals.length,
    bendCount: others.filter((piece) => piece.kind.startsWith("bend-")).length,
    wallCount: layout.walls.length,
    exitWidth: exits[0]!.width,
    exits,
    horizontalCount: countKind("horizontal"),
    verticalCount: countKind("vertical"),
    smallCount: countKind("small"),
    squareCount: countKind("square"),
    emptyCellCount: countHakoiriMusumeProblemEmptyCells(problem),
    emptyGroupCount: countEmptyGroups(problem),
  };
}

/** 問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHakoiriMusumePoolProblemFeatures(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumeProblemFeatures | null {
  const entry = findHakoiriMusumePoolEntryByProblemId(difficulty, problemId);
  return entry
    ? measureHakoiriMusumeProblemFeatures(
        restoreHakoiriMusumePoolEntry(entry).problem,
      )
    : null;
}

/** 最短手数は解かないと分からないので軸にしない。 */
export const hakoiriMusumeProblemFeatureAxes = [
  {
    id: "board-size",
    getValue({ rows, columns }) {
      return createBoardSizeFeatureValue(rows, columns);
    },
  },
  {
    id: "target-count",
    getValue({ targetCount }) {
      return createCountFeatureValue(targetCount);
    },
  },
  {
    id: "exit-width",
    getValue({ exitWidth }) {
      return createCountFeatureValue(exitWidth);
    },
  },
  {
    id: "bend-count",
    getValue({ bendCount }) {
      return createCountFeatureValue(bendCount);
    },
  },
  {
    id: "wall-count",
    getValue({ wallCount }) {
      return createCountFeatureValue(wallCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<HakoiriMusumeProblemFeatures>[];

export type HakoiriMusumeProblemFeatureAxisId =
  (typeof hakoiriMusumeProblemFeatureAxes)[number]["id"];
