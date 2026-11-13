import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import {
  ICE_FLOOR_MAZE_GENERATOR_VERSION,
  type IceFloorMazeIdentifiedProblem,
  type IceFloorMazeProblemIdentity,
  restoreIceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";
import problemPoolJson from "@/games/ice-floor-maze/problem/problem-pool.json";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/** `seed` は盤面そのものの符号なので、実行時に生成器・難易度分析を走らせずに問題を復元できる。 */
export type IceFloorMazeProblemPoolEntry = readonly [
  seed: string,
  width: number,
  height: number,
  optimalMoveCount: number,
];

export type IceFloorMazeProblemPool = {
  generatorVersion: typeof ICE_FLOOR_MAZE_GENERATOR_VERSION;
  levels: Record<
    IceFloorMazeDifficulty,
    readonly IceFloorMazeProblemPoolEntry[]
  >;
};

type IceFloorMazeDecodedPoolEntry = {
  identity: IceFloorMazeProblemIdentity;
  optimalMoveCount: number;
};

/** `optimalMoveCount` は評価の基準に使う。 */
export type IceFloorMazePooledProblem = IceFloorMazeIdentifiedProblem & {
  optimalMoveCount: number;
};

const problemPool = problemPoolJson as unknown as IceFloorMazeProblemPool;

export function decodeIceFloorMazePoolEntry([
  seed,
  width,
  height,
  optimalMoveCount,
]: IceFloorMazeProblemPoolEntry): IceFloorMazeDecodedPoolEntry {
  return {
    identity: {
      generatorVersion: ICE_FLOOR_MAZE_GENERATOR_VERSION,
      seed,
      conditions: { width, height },
    },
    optimalMoveCount,
  };
}

export function restoreIceFloorMazePoolEntry(
  entry: IceFloorMazeProblemPoolEntry,
): IceFloorMazePooledProblem {
  const { identity, optimalMoveCount } = decodeIceFloorMazePoolEntry(entry);
  return { ...restoreIceFloorMazeProblem(identity), optimalMoveCount };
}

export function listIceFloorMazePoolEntries(
  difficulty: IceFloorMazeDifficulty,
): readonly IceFloorMazeProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  (entry) => decodeIceFloorMazePoolEntry(entry).identity,
);

/** 問題集の並び順で返す。 */
export function listIceFloorMazePoolProblemIds(
  difficulty: IceFloorMazeDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findIceFloorMazePoolEntryByProblemId(
  difficulty: IceFloorMazeDifficulty,
  problemId: string,
): IceFloorMazeProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}
