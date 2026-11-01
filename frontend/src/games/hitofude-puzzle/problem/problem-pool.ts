import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import {
  assertHitofudePuzzleProblem,
  createHitofudePuzzleProblemIdentity,
  type HITOFUDE_PUZZLE_GENERATOR_VERSION,
  type HitofudePuzzleIdentifiedProblem,
  type HitofudePuzzleProblem,
  type HitofudePuzzleProblemIdentity,
  type HitofudePuzzleSolveWorkload,
  isHitofudePuzzleBoardSize,
  isHitofudePuzzleTargetAssumptionCount,
} from "@/games/hitofude-puzzle/problem/problem";
import problemPoolJson from "@/games/hitofude-puzzle/problem/problem-pool.json";
import {
  type HitofudePuzzleBoard,
  listHitofudePuzzleCells,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  createBoardSizeFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/**
 * 事前生成した問題集の1問。
 * - `size`・`targetAssumptionCount`・`candidateIndex` から `createHitofudePuzzleProblemIdentity` で identity を再構成する。
 * - `start` と `encodedHoles`（`encodeHitofudePuzzlePoolHoles`）で盤面を表す。解の道は持たない。
 *   実行時に生成器・解探索を呼ばずに問題を復元するため、生成結果そのものを持つ。
 * - 残りは生成時の分析結果（`HitofudePuzzleSolveWorkload`）。速さの基準時間に使う。
 *   プレイ時に解法器を動かさずに済むよう、問題集に持たせる。なぞる長さは盤面から求まるので持たない。
 */
export type HitofudePuzzleProblemPoolEntry = readonly [
  size: number,
  targetAssumptionCount: number,
  candidateIndex: number,
  start: number,
  encodedHoles: string,
  assumptionCount: number,
  refutationStepCount: number,
  longestRefutationLength: number,
  fatalBranchCount: number,
];

/** 問題集から復元した1問。問題を解き切る作業の量を伴う。 */
export type HitofudePuzzlePooledProblem = HitofudePuzzleIdentifiedProblem & {
  workload: HitofudePuzzleSolveWorkload;
};

export type HitofudePuzzleProblemPool = {
  generatorVersion: typeof HITOFUDE_PUZZLE_GENERATOR_VERSION;
  levels: Record<
    HitofudePuzzleDifficulty,
    readonly HitofudePuzzleProblemPoolEntry[]
  >;
};

const problemPool = problemPoolJson as unknown as HitofudePuzzleProblemPool;

const bitsPerHexDigit = 4;

function countHoleHexDigits(size: number): number {
  return Math.ceil((size * size) / bitsPerHexDigit);
}

/**
 * 穴を、枠の全マス（行優先）の順のビット列（穴なら 1）にして16進で表す。先頭のビットを最上位にし、末尾は 0 で埋める。
 * 例: 8×8 は 64 ビットで 16 桁。
 */
export function encodeHitofudePuzzlePoolHoles(
  board: HitofudePuzzleBoard,
): string {
  const holes = new Set(board.holes);
  const bits = listHitofudePuzzleCells(board.size).map((cell) =>
    holes.has(cell),
  );
  let encoded = "";
  for (let offset = 0; offset < bits.length; offset += bitsPerHexDigit) {
    let digit = 0;
    for (let bit = 0; bit < bitsPerHexDigit; bit += 1) {
      digit = (digit << 1) | (bits[offset + bit] ? 1 : 0);
    }
    encoded += digit.toString(16);
  }
  return encoded;
}

/** `encodeHitofudePuzzlePoolHoles` で表した穴と始点から問題を作り、形を確かめる。 */
export function decodeHitofudePuzzlePoolProblem(
  size: number,
  start: number,
  encodedHoles: string,
): HitofudePuzzleProblem {
  if (!isHitofudePuzzleBoardSize(size)) {
    throw new RangeError(`Unsupported Hitofude puzzle board size: ${size}`);
  }
  if (
    !/^[0-9a-f]+$/.test(encodedHoles) ||
    encodedHoles.length !== countHoleHexDigits(size)
  ) {
    throw new RangeError(
      `Hitofude puzzle pool holes must be ${countHoleHexDigits(size)} lowercase hex digits`,
    );
  }
  const bits = Array.from(encodedHoles).flatMap((character) => {
    const digit = Number.parseInt(character, 16);
    return Array.from(
      { length: bitsPerHexDigit },
      (_, bit) => ((digit >> (bitsPerHexDigit - 1 - bit)) & 1) === 1,
    );
  });
  if (bits.slice(size * size).some(Boolean)) {
    throw new RangeError("Hitofude puzzle pool holes have padding bits");
  }
  const problem: HitofudePuzzleProblem = {
    size,
    holes: listHitofudePuzzleCells(size).filter((cell) => bits[cell]),
    start,
  };
  assertHitofudePuzzleProblem(problem);
  return problem;
}

export function toHitofudePuzzlePoolIdentity([
  size,
  targetAssumptionCount,
  candidateIndex,
]: HitofudePuzzleProblemPoolEntry): HitofudePuzzleProblemIdentity {
  if (!isHitofudePuzzleBoardSize(size)) {
    throw new RangeError(`Unsupported Hitofude puzzle board size: ${size}`);
  }
  if (!isHitofudePuzzleTargetAssumptionCount(targetAssumptionCount)) {
    throw new RangeError(
      `Unsupported Hitofude puzzle target assumption count: ${targetAssumptionCount}`,
    );
  }
  return createHitofudePuzzleProblemIdentity(
    size,
    targetAssumptionCount,
    candidateIndex,
  );
}

export function toHitofudePuzzlePooledProblem(
  entry: HitofudePuzzleProblemPoolEntry,
): HitofudePuzzlePooledProblem {
  const [
    size,
    ,
    ,
    start,
    encodedHoles,
    assumptionCount,
    refutationStepCount,
    longestRefutationLength,
    fatalBranchCount,
  ] = entry;
  const problem = decodeHitofudePuzzlePoolProblem(size, start, encodedHoles);
  return {
    problem,
    identity: toHitofudePuzzlePoolIdentity(entry),
    workload: {
      openCellCount: listHitofudePuzzleOpenCells(problem).length,
      assumptionCount,
      refutationStepCount,
      longestRefutationLength,
      fatalBranchCount,
    },
  };
}

export function listHitofudePuzzlePoolEntries(
  difficulty: HitofudePuzzleDifficulty,
): readonly HitofudePuzzleProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  toHitofudePuzzlePoolIdentity,
);

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHitofudePuzzlePoolEntryByProblemId(
  difficulty: HitofudePuzzleDifficulty,
  problemId: string,
): HitofudePuzzleProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

let entriesBySeed:
  | ReadonlyMap<string, HitofudePuzzleProblemPoolEntry>
  | undefined;

function getEntriesBySeed(): ReadonlyMap<
  string,
  HitofudePuzzleProblemPoolEntry
> {
  entriesBySeed ??= new Map(
    Object.values(problemPool.levels)
      .flat()
      .map((entry) => [toHitofudePuzzlePoolIdentity(entry).seed, entry]),
  );
  return entriesBySeed;
}

/** identity に一致する問題集の1問を探す。生成器の版や条件が違う identity・問題集に無い identity には `null` を返す。 */
export function findHitofudePuzzlePoolEntry(
  identity: HitofudePuzzleProblemIdentity,
): HitofudePuzzleProblemPoolEntry | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }
  const entry = getEntriesBySeed().get(identity.seed);
  if (!entry) {
    return null;
  }
  const { conditions } = toHitofudePuzzlePoolIdentity(entry);
  return conditions.size === identity.conditions.size &&
    conditions.targetAssumptionCount ===
      identity.conditions.targetAssumptionCount
    ? entry
    : null;
}

/** 難易度の問題集の全問の問題 ID を、問題集の並び順で返す。 */
export function listHitofudePuzzlePoolProblemIds(
  difficulty: HitofudePuzzleDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 始めたときの盤面を見れば分かる、問題の特徴。 */
export type HitofudePuzzleProblemFeatures = {
  size: number;
};

/** 難易度の問題集の1問の特徴を、問題を復元せず問題集の項目から求める。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHitofudePuzzlePoolProblemFeatures(
  difficulty: HitofudePuzzleDifficulty,
  problemId: string,
): HitofudePuzzleProblemFeatures | null {
  const entry = findHitofudePuzzlePoolEntryByProblemId(difficulty, problemId);
  return entry ? { size: entry[0] } : null;
}

/** 図鑑の絞り込みで問題を分ける特徴の軸。 */
export const hitofudePuzzleProblemFeatureAxes = [
  {
    id: "board-size",
    getValue({ size }) {
      return createBoardSizeFeatureValue(size, size);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<HitofudePuzzleProblemFeatures>[];

export type HitofudePuzzleProblemFeatureAxisId =
  (typeof hitofudePuzzleProblemFeatureAxes)[number]["id"];
