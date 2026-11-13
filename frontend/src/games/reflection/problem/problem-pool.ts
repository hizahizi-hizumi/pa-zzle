import { difficultyLevels } from "@/games/difficulty";
import {
  createBoardSizeFeatureValue,
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import {
  fromReflectionCellCode,
  type ReflectionCellCode,
  toReflectionCellCode,
} from "@/games/reflection/problem/generation/cell-code";
import {
  assertReflectionProblem,
  createReflectionProblemIdentity,
  isReflectionBoardSize,
  type REFLECTION_GENERATOR_VERSION,
  type ReflectionIdentifiedProblem,
  type ReflectionProblem,
  type ReflectionProblemIdentity,
  type ReflectionSolveWorkload,
} from "@/games/reflection/problem/problem";
import problemPoolJson from "@/games/reflection/problem/problem-pool.json";
import {
  countReflectionBoardPieces,
  getReflectionInventoryPieceCount,
  type ReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";

export type ReflectionProblemPoolEntry = readonly [
  candidateIndex: number,
  // 手持ちと外周ヒントは解から求まるので持たない。実行時に生成器・解探索を呼ばずに問題を復元するため、生成結果そのものを持つ。
  encodedSolution: string,
  // 生成時の分析結果（`ReflectionSolveWorkload`）。プレイ時に解法器を動かさずに済むよう、問題集に持たせる。
  propagationRoundCount: number,
  assumptionTestCount: number,
  trialMoveCount: number | null,
];

export type ReflectionProblemPoolReference = {
  /** 問題集を作り直して問題の並びが変わったら上げる。 */
  poolVersion: string;
  problemId: string;
};

export type ReflectionPooledProblem = ReflectionIdentifiedProblem & {
  poolReference: ReflectionProblemPoolReference;
  workload: ReflectionSolveWorkload;
};

export type ReflectionProblemPool = {
  poolVersion: string;
  generatorVersion: typeof REFLECTION_GENERATOR_VERSION;
  levels: Record<ReflectionDifficulty, readonly ReflectionProblemPoolEntry[]>;
};

const problemPool = problemPoolJson as unknown as ReflectionProblemPool;

export function encodeReflectionPoolSolution(
  solution: ReflectionBoard,
): string {
  return solution.cells.map(toReflectionCellCode).join("");
}

export function decodeReflectionPoolSolution(encoded: string): ReflectionBoard {
  const size = Math.sqrt(encoded.length);
  if (!isReflectionBoardSize(size)) {
    throw new RangeError(
      `Reflection pool solution must fill a supported square board: ${encoded.length} cells`,
    );
  }
  if (!/^[0-6]+$/.test(encoded)) {
    throw new RangeError("Reflection pool solution must use cell codes 0-6");
  }
  return {
    size,
    cells: Array.from(encoded, (digit) =>
      fromReflectionCellCode(Number(digit) as ReflectionCellCode),
    ),
  };
}

function toProblem(solution: ReflectionBoard): ReflectionProblem {
  const problem: ReflectionProblem = {
    size: solution.size,
    inventory: countReflectionBoardPieces(solution),
    clues: computeReflectionClues(solution),
    solution,
  };
  assertReflectionProblem(problem);
  return problem;
}

function toIdentity(
  candidateIndex: number,
  solution: ReflectionBoard,
): ReflectionProblemIdentity {
  const size = solution.size;
  if (!isReflectionBoardSize(size)) {
    throw new RangeError(`Unsupported Reflection board size: ${size}`);
  }
  return createReflectionProblemIdentity(
    size,
    getReflectionInventoryPieceCount(countReflectionBoardPieces(solution)),
    candidateIndex,
  );
}

export function toReflectionPoolIdentity([
  candidateIndex,
  encodedSolution,
]: ReflectionProblemPoolEntry): ReflectionProblemIdentity {
  return toIdentity(
    candidateIndex,
    decodeReflectionPoolSolution(encodedSolution),
  );
}

export function formatReflectionPoolProblemId(
  difficulty: ReflectionDifficulty,
  entryIndex: number,
): string {
  return `${difficulty}-${entryIndex + 1}`;
}

export function restoreReflectionPoolEntry(
  [
    candidateIndex,
    encodedSolution,
    propagationRoundCount,
    assumptionTestCount,
    trialMoveCount,
  ]: ReflectionProblemPoolEntry,
  poolReference: ReflectionProblemPoolReference,
): ReflectionPooledProblem {
  const solution = decodeReflectionPoolSolution(encodedSolution);
  const problem = toProblem(solution);
  return {
    problem,
    identity: toIdentity(candidateIndex, solution),
    poolReference,
    workload: {
      pieceCount: getReflectionInventoryPieceCount(problem.inventory),
      clueCount: problem.clues.length,
      propagationRoundCount,
      assumptionTestCount,
      trialMoveCount,
    },
  };
}

export function toReflectionPooledProblem(
  difficulty: ReflectionDifficulty,
  entryIndex: number,
): ReflectionPooledProblem {
  const problemId = formatReflectionPoolProblemId(difficulty, entryIndex);
  const entry = problemPool.levels[difficulty][entryIndex];
  if (!entry) {
    throw new RangeError(`No Reflection pool problem ${problemId}`);
  }
  return restoreReflectionPoolEntry(entry, {
    poolVersion: problemPool.poolVersion,
    problemId,
  });
}

export function listReflectionPoolEntries(
  difficulty: ReflectionDifficulty,
): readonly ReflectionProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  toReflectionPoolIdentity,
);

export function listReflectionPoolProblemIds(
  difficulty: ReflectionDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

export function hasReflectionPoolProblemId(
  difficulty: ReflectionDifficulty,
  problemId: string,
): boolean {
  return poolIndex.findPositionById(difficulty, problemId) !== null;
}

export function findReflectionPooledProblemByProblemId(
  difficulty: ReflectionDifficulty,
  problemId: string,
): ReflectionPooledProblem | null {
  const position = poolIndex.findPositionById(difficulty, problemId);
  return position
    ? toReflectionPooledProblem(difficulty, position.entryIndex)
    : null;
}

type PoolPosition = { difficulty: ReflectionDifficulty; entryIndex: number };

let positionsBySeed: ReadonlyMap<string, PoolPosition> | undefined;

function getPositionsBySeed(): ReadonlyMap<string, PoolPosition> {
  positionsBySeed ??= new Map(
    difficultyLevels.flatMap(({ id: difficulty }) =>
      problemPool.levels[difficulty].map(
        (entry, entryIndex) =>
          [
            toReflectionPoolIdentity(entry).seed,
            { difficulty, entryIndex },
          ] as const,
      ),
    ),
  );
  return positionsBySeed;
}

export function findReflectionPooledProblem(
  identity: ReflectionProblemIdentity,
): ReflectionPooledProblem | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }
  const position = getPositionsBySeed().get(identity.seed);
  if (!position) {
    return null;
  }
  const pooled = toReflectionPooledProblem(
    position.difficulty,
    position.entryIndex,
  );
  const { conditions } = pooled.identity;
  return conditions.size === identity.conditions.size &&
    conditions.pieceCount === identity.conditions.pieceCount
    ? pooled
    : null;
}

export type ReflectionProblemFeatures = {
  size: number;
  /** ピースの数は手持ちのピースの数。 */
  pieceCount: number;
};

export function findReflectionPoolProblemFeatures(
  difficulty: ReflectionDifficulty,
  problemId: string,
): ReflectionProblemFeatures | null {
  const entry = poolIndex.findPositionById(difficulty, problemId)?.entry;
  if (!entry) {
    return null;
  }
  const solution = decodeReflectionPoolSolution(entry[1]);
  return {
    size: solution.size,
    pieceCount: getReflectionInventoryPieceCount(
      countReflectionBoardPieces(solution),
    ),
  };
}

export const reflectionProblemFeatureAxes = [
  {
    id: "board-size",
    getValue({ size }) {
      return createBoardSizeFeatureValue(size, size);
    },
  },
  {
    id: "piece-count",
    getValue({ pieceCount }) {
      return createCountFeatureValue(pieceCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<ReflectionProblemFeatures>[];

export type ReflectionProblemFeatureAxisId =
  (typeof reflectionProblemFeatureAxes)[number]["id"];
