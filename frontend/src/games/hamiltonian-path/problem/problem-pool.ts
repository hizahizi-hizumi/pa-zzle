import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import {
  assertHamiltonianPathProblem,
  createHamiltonianPathProblemIdentity,
  type HAMILTONIAN_PATH_GENERATOR_VERSION,
  type HamiltonianPathIdentifiedProblem,
  type HamiltonianPathProblem,
  type HamiltonianPathProblemIdentity,
  type HamiltonianPathSolveWorkload,
  type HamiltonianPathWallRatio,
  hamiltonianPathWallRatios,
  isHamiltonianPathBoardSize,
} from "@/games/hamiltonian-path/problem/problem";
import problemPoolJson from "@/games/hamiltonian-path/problem/problem-pool.json";
import {
  createHamiltonianPathPartition,
  type HamiltonianPathBoard,
  type HamiltonianPathPartition,
  hasHamiltonianPathPartition,
  listHamiltonianPathOpenCells,
  normalizeHamiltonianPathPartitions,
} from "@/games/hamiltonian-path/puzzle/board";
import {
  createBoardSizeFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/**
 * 事前生成した問題集の1問。
 * - `size`・`wallPercent`（壁率の百分率）・`candidateIndex` から `createHamiltonianPathProblemIdentity` で identity を再構成する。
 * - `start` と `encodedObstacles`（`encodeHamiltonianPathPoolObstacles`）で盤面を表す。解の道は持たない。
 *   実行時に生成器・解探索を呼ばずに問題を復元するため、生成結果そのものを持つ。
 * - 残りは生成時の分析結果（`HamiltonianPathSolveWorkload`）。速さの基準時間に使う。
 *   プレイ時に解法器を動かさずに済むよう、問題集に持たせる。なぞる長さは盤面から求まるので持たない。
 */
export type HamiltonianPathProblemPoolEntry = readonly [
  size: number,
  wallPercent: number,
  candidateIndex: number,
  start: number,
  encodedObstacles: string,
  assumptionCount: number,
  refutationStepCount: number,
  longestRefutationLength: number,
  fatalBranchCount: number,
];

/** 問題集から復元した1問。問題を解き切る作業の量を伴う。 */
export type HamiltonianPathPooledProblem = HamiltonianPathIdentifiedProblem & {
  workload: HamiltonianPathSolveWorkload;
};

export type HamiltonianPathProblemPool = {
  generatorVersion: typeof HAMILTONIAN_PATH_GENERATOR_VERSION;
  levels: Record<
    HamiltonianPathDifficulty,
    readonly HamiltonianPathProblemPoolEntry[]
  >;
};

const problemPool = problemPoolJson as unknown as HamiltonianPathProblemPool;

const bitsPerHexDigit = 4;

type ObstacleSlot =
  | { kind: "wall"; cell: number }
  | { kind: "partition"; partition: HamiltonianPathPartition };

/**
 * 盤面の障害物を1列のビットに並べる順。壁マス（行優先の全マス）、左右に隣り合うマスの間の仕切り
 * （行優先で、各行の右端を除くマスとその右のマス）、上下に隣り合うマスの間の仕切り（行優先で、最下行を除くマスとその下のマス）。
 */
function listObstacleSlots(size: number): readonly ObstacleSlot[] {
  const cells = Array.from({ length: size * size }, (_, cell) => cell);
  return [
    ...cells.map((cell): ObstacleSlot => ({ kind: "wall", cell })),
    ...cells
      .filter((cell) => cell % size < size - 1)
      .map(
        (cell): ObstacleSlot => ({
          kind: "partition",
          partition: createHamiltonianPathPartition(cell, cell + 1),
        }),
      ),
    ...cells
      .filter((cell) => cell < size * (size - 1))
      .map(
        (cell): ObstacleSlot => ({
          kind: "partition",
          partition: createHamiltonianPathPartition(cell, cell + size),
        }),
      ),
  ];
}

function countObstacleHexDigits(size: number): number {
  return Math.ceil(listObstacleSlots(size).length / bitsPerHexDigit);
}

/**
 * 壁マスと仕切りを、`listObstacleSlots` の順のビット列（あれば 1）にして16進で表す。先頭のビットを最上位にし、末尾は 0 で埋める。
 * 例: 8×8 は 64 + 56 + 56 = 176 ビットで 44 桁。
 */
export function encodeHamiltonianPathPoolObstacles(
  board: HamiltonianPathBoard,
): string {
  const walls = new Set(board.walls);
  const bits = listObstacleSlots(board.size).map((slot) =>
    slot.kind === "wall"
      ? walls.has(slot.cell)
      : hasHamiltonianPathPartition(board, ...slot.partition),
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

/** `encodeHamiltonianPathPoolObstacles` で表した障害物と始点から問題を作り、形を確かめる。 */
export function decodeHamiltonianPathPoolProblem(
  size: number,
  start: number,
  encodedObstacles: string,
): HamiltonianPathProblem {
  if (!isHamiltonianPathBoardSize(size)) {
    throw new RangeError(`Unsupported Hamiltonian path board size: ${size}`);
  }
  if (
    !/^[0-9a-f]+$/.test(encodedObstacles) ||
    encodedObstacles.length !== countObstacleHexDigits(size)
  ) {
    throw new RangeError(
      `Hamiltonian path pool obstacles must be ${countObstacleHexDigits(size)} lowercase hex digits`,
    );
  }
  const bits = Array.from(encodedObstacles).flatMap((character) => {
    const digit = Number.parseInt(character, 16);
    return Array.from(
      { length: bitsPerHexDigit },
      (_, bit) => ((digit >> (bitsPerHexDigit - 1 - bit)) & 1) === 1,
    );
  });
  const slots = listObstacleSlots(size);
  const presentSlots = slots.filter((_, index) => bits[index]);
  const problem: HamiltonianPathProblem = {
    size,
    walls: presentSlots.flatMap((slot) =>
      slot.kind === "wall" ? [slot.cell] : [],
    ),
    partitions: normalizeHamiltonianPathPartitions(
      presentSlots.flatMap((slot) =>
        slot.kind === "partition" ? [slot.partition] : [],
      ),
    ),
    start,
  };
  if (bits.slice(slots.length).some(Boolean)) {
    throw new RangeError("Hamiltonian path pool obstacles have padding bits");
  }
  assertHamiltonianPathProblem(problem);
  return problem;
}

function toWallRatio(wallPercent: number): HamiltonianPathWallRatio {
  const wallRatio = hamiltonianPathWallRatios.find(
    (ratio) => Math.round(ratio * 100) === wallPercent,
  );
  if (wallRatio === undefined) {
    throw new RangeError(
      `Unsupported Hamiltonian path wall percent: ${wallPercent}`,
    );
  }
  return wallRatio;
}

export function toHamiltonianPathPoolIdentity([
  size,
  wallPercent,
  candidateIndex,
]: HamiltonianPathProblemPoolEntry): HamiltonianPathProblemIdentity {
  if (!isHamiltonianPathBoardSize(size)) {
    throw new RangeError(`Unsupported Hamiltonian path board size: ${size}`);
  }
  return createHamiltonianPathProblemIdentity(
    size,
    toWallRatio(wallPercent),
    candidateIndex,
  );
}

export function toHamiltonianPathPooledProblem(
  entry: HamiltonianPathProblemPoolEntry,
): HamiltonianPathPooledProblem {
  const [
    size,
    ,
    ,
    start,
    encodedObstacles,
    assumptionCount,
    refutationStepCount,
    longestRefutationLength,
    fatalBranchCount,
  ] = entry;
  const problem = decodeHamiltonianPathPoolProblem(
    size,
    start,
    encodedObstacles,
  );
  return {
    problem,
    identity: toHamiltonianPathPoolIdentity(entry),
    workload: {
      openCellCount: listHamiltonianPathOpenCells(problem).length,
      assumptionCount,
      refutationStepCount,
      longestRefutationLength,
      fatalBranchCount,
    },
  };
}

export function listHamiltonianPathPoolEntries(
  difficulty: HamiltonianPathDifficulty,
): readonly HamiltonianPathProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  toHamiltonianPathPoolIdentity,
);

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHamiltonianPathPoolEntryByProblemId(
  difficulty: HamiltonianPathDifficulty,
  problemId: string,
): HamiltonianPathProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

let entriesBySeed:
  | ReadonlyMap<string, HamiltonianPathProblemPoolEntry>
  | undefined;

function getEntriesBySeed(): ReadonlyMap<
  string,
  HamiltonianPathProblemPoolEntry
> {
  entriesBySeed ??= new Map(
    Object.values(problemPool.levels)
      .flat()
      .map((entry) => [toHamiltonianPathPoolIdentity(entry).seed, entry]),
  );
  return entriesBySeed;
}

/** identity に一致する問題集の1問を探す。生成器の版や条件が違う identity・問題集に無い identity には `null` を返す。 */
export function findHamiltonianPathPoolEntry(
  identity: HamiltonianPathProblemIdentity,
): HamiltonianPathProblemPoolEntry | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }
  const entry = getEntriesBySeed().get(identity.seed);
  if (!entry) {
    return null;
  }
  const { conditions } = toHamiltonianPathPoolIdentity(entry);
  return conditions.size === identity.conditions.size &&
    conditions.wallRatio === identity.conditions.wallRatio
    ? entry
    : null;
}

/** 難易度の問題集の全問の問題 ID を、問題集の並び順で返す。 */
export function listHamiltonianPathPoolProblemIds(
  difficulty: HamiltonianPathDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 始めたときの盤面を見れば分かる、問題の特徴。 */
export type HamiltonianPathProblemFeatures = {
  size: number;
};

/** 難易度の問題集の1問の特徴を、問題を復元せず問題集の項目から求める。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHamiltonianPathPoolProblemFeatures(
  difficulty: HamiltonianPathDifficulty,
  problemId: string,
): HamiltonianPathProblemFeatures | null {
  const entry = findHamiltonianPathPoolEntryByProblemId(difficulty, problemId);
  return entry ? { size: entry[0] } : null;
}

/** 図鑑の絞り込みで問題を分ける特徴の軸。 */
export const hamiltonianPathProblemFeatureAxes = [
  {
    id: "board-size",
    getValue({ size }) {
      return createBoardSizeFeatureValue(size, size);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<HamiltonianPathProblemFeatures>[];

export type HamiltonianPathProblemFeatureAxisId =
  (typeof hamiltonianPathProblemFeatureAxes)[number]["id"];
