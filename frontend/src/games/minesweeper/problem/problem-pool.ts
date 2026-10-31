import type {
  MinesweeperDifficulty,
  MinesweeperDifficultyBoardCondition,
} from "@/games/minesweeper/difficulty";
import {
  MINESWEEPER_GENERATOR_VERSION,
  type MinesweeperProblemIdentity,
} from "@/games/minesweeper/problem/problem";
import problemPoolJson from "@/games/minesweeper/problem/problem-pool.json";
import { createProblemPoolIdLookup } from "@/games/problem-id";

/**
 * 事前生成した問題集の1問。
 * seed は難易度・盤面条件・候補番号から `createMinesweeperPoolSeed` で再構成し、
 * 生成は各 seed の最初の候補だけを使うため、試行回数と開始マスの決め方は持たない。
 */
export type MinesweeperProblemPoolEntry = readonly [
  rows: number,
  columns: number,
  mineCount: number,
  candidateIndex: number,
];

export type MinesweeperProblemPool = {
  generatorVersion: typeof MINESWEEPER_GENERATOR_VERSION;
  levels: Record<MinesweeperDifficulty, readonly MinesweeperProblemPoolEntry[]>;
};

const problemPool = problemPoolJson as unknown as MinesweeperProblemPool;

export function createMinesweeperPoolSeed(
  difficulty: MinesweeperDifficulty,
  { rows, columns, mineCount }: MinesweeperDifficultyBoardCondition,
  candidateIndex: number,
): string {
  return `ms-pool-${difficulty}-${rows}x${columns}-${mineCount}-${candidateIndex}`;
}

export function createMinesweeperPoolIdentity(
  difficulty: MinesweeperDifficulty,
  condition: MinesweeperDifficultyBoardCondition,
  candidateIndex: number,
): MinesweeperProblemIdentity {
  return {
    generatorVersion: MINESWEEPER_GENERATOR_VERSION,
    seed: createMinesweeperPoolSeed(difficulty, condition, candidateIndex),
    conditions: {
      rows: condition.rows,
      columns: condition.columns,
      mineCount: condition.mineCount,
      startCellPlacement: "random",
    },
    generationAttempt: 1,
  };
}

export function toMinesweeperPoolIdentity(
  difficulty: MinesweeperDifficulty,
  [rows, columns, mineCount, candidateIndex]: MinesweeperProblemPoolEntry,
): MinesweeperProblemIdentity {
  return createMinesweeperPoolIdentity(
    difficulty,
    { rows, columns, mineCount },
    candidateIndex,
  );
}

export function listMinesweeperPoolEntries(
  difficulty: MinesweeperDifficulty,
): readonly MinesweeperProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const findPoolPositionByProblemId = createProblemPoolIdLookup(
  problemPool.levels,
  (entry, difficulty) => toMinesweeperPoolIdentity(difficulty, entry),
);

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findMinesweeperPoolEntryByProblemId(
  difficulty: MinesweeperDifficulty,
  problemId: string,
): MinesweeperProblemPoolEntry | null {
  return findPoolPositionByProblemId(difficulty, problemId)?.entry ?? null;
}
