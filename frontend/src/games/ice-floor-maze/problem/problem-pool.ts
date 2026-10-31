import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import {
  ICE_FLOOR_MAZE_GENERATOR_VERSION,
  type IceFloorMazeIdentifiedProblem,
  type IceFloorMazeProblemIdentity,
  restoreIceFloorMazeProblem,
} from "@/games/ice-floor-maze/problem/problem";
import problemPoolJson from "@/games/ice-floor-maze/problem/problem-pool.json";
import { createProblemPoolIdLookup } from "@/games/problem-id";

/**
 * 事前生成した問題集の1問。
 * - `seed` / `width` / `height`: 問題の identity（`IceFloorMazeProblemIdentity`）の `seed` と盤面の形。`seed` は盤面そのものの
 *   符号なので、実行時に生成器・難易度分析を走らせずに問題を復元できる。
 * - `optimalMoveCount`: 開始位置からゴールで止まるまでの最少手数。評価の基準に使う。
 */
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

/** 問題集の1項目を読み解いた値。問題は identity から復号する。 */
type IceFloorMazeDecodedPoolEntry = {
  identity: IceFloorMazeProblemIdentity;
  optimalMoveCount: number;
};

/** 問題集から復元した1問。評価の基準になる最少手数を伴う。 */
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

/** 問題集の1項目から問題を復元する。 */
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

const findPoolPositionByProblemId = createProblemPoolIdLookup(
  problemPool.levels,
  (entry) => decodeIceFloorMazePoolEntry(entry).identity,
);

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findIceFloorMazePoolEntryByProblemId(
  difficulty: IceFloorMazeDifficulty,
  problemId: string,
): IceFloorMazeProblemPoolEntry | null {
  return findPoolPositionByProblemId(difficulty, problemId)?.entry ?? null;
}
