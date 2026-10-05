import { difficultyLevels } from "@/games/difficulty";
import { createProblemPoolIdLookup } from "@/games/problem-id";
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

/**
 * 事前生成した問題集の1問。
 * - `candidateIndex` と `encodedSolution` から得る盤面サイズ・ピース数で、`createReflectionProblemIdentity` の identity を再構成する。
 * - `encodedSolution` は解の各マスを `ReflectionCellCode`（`0` が空き、`1`〜`6` がピース）の1桁で行優先に並べた文字列。
 *   手持ちと外周ヒントは解から求まるので持たない。実行時に生成器・解探索を呼ばずに問題を復元するため、生成結果そのものを持つ。
 * - `propagationRoundCount` / `assumptionTestCount` / `trialMoveCount` は生成時の分析結果（`ReflectionSolveWorkload`）。
 *   速さの基準時間に使う。プレイ時に解法器を動かさずに済むよう、問題集に持たせる。
 */
export type ReflectionProblemPoolEntry = readonly [
  candidateIndex: number,
  encodedSolution: string,
  propagationRoundCount: number,
  assumptionTestCount: number,
  trialMoveCount: number | null,
];

/**
 * 問題集の中の1問を指す識別情報。
 * - `poolVersion`: 問題集を作り直して問題の並びが変わったら上げる。
 * - `problemId`: `<レベル>-<番号>`（番号はレベルの中の1始まりの並び順）。例: `4-17`。
 * 生成器の identity（`ReflectionProblemIdentity`）とは相互に引ける。
 */
export type ReflectionProblemPoolReference = {
  poolVersion: string;
  problemId: string;
};

/** 問題集から復元した1問。問題集の中の位置と、問題を解き切る作業の量を伴う。 */
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

/** 問題集の1問を、問題集の中の位置 `poolReference` を添えて復元する。 */
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

const findPoolPositionByProblemId = createProblemPoolIdLookup(
  problemPool.levels,
  toReflectionPoolIdentity,
);

/** 難易度の問題集に問題 ID の問題があるかを返す。 */
export function hasReflectionPoolProblemId(
  difficulty: ReflectionDifficulty,
  problemId: string,
): boolean {
  return findPoolPositionByProblemId(difficulty, problemId) !== null;
}

/** 難易度の問題集から問題 ID で1問を探して復元する。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findReflectionPooledProblemByProblemId(
  difficulty: ReflectionDifficulty,
  problemId: string,
): ReflectionPooledProblem | null {
  const position = findPoolPositionByProblemId(difficulty, problemId);
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

/** identity に一致する問題集の1問を復元する。生成器の版や条件が違う identity・問題集に無い identity には `null` を返す。 */
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
