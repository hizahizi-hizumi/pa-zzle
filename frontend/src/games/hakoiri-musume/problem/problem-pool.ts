import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import {
  HAKOIRI_MUSUME_GENERATOR_VERSION,
  type HakoiriMusumeIdentifiedProblem,
  type HakoiriMusumeProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import problemPoolJson from "@/games/hakoiri-musume/problem/problem-pool.json";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/**
 * 問題集の1問。
 * - `board`: 始めたときの盤面の20文字。問題の identity の `seed` で、生成器を走らせずに問題を復元できる。
 * - `optimalMoveCount`: 娘を出口の前へ運ぶ最短手数（同じ駒を続けて動かした移動を1手と数える）。評価の基準に使う。
 */
export type HakoiriMusumeProblemPoolEntry = readonly [
  board: string,
  optimalMoveCount: number,
];

export type HakoiriMusumeProblemPool = {
  generatorVersion: typeof HAKOIRI_MUSUME_GENERATOR_VERSION;
  levels: Record<
    HakoiriMusumeDifficulty,
    readonly HakoiriMusumeProblemPoolEntry[]
  >;
};

/** 問題集の1項目を読み解いた値。問題は identity から復元する。 */
type HakoiriMusumeDecodedPoolEntry = {
  identity: HakoiriMusumeProblemIdentity;
  optimalMoveCount: number;
};

/** 問題集から復元した1問。評価の基準になる最短手数を伴う。 */
export type HakoiriMusumePooledProblem = HakoiriMusumeIdentifiedProblem & {
  optimalMoveCount: number;
};

const problemPool = problemPoolJson as unknown as HakoiriMusumeProblemPool;

export function decodeHakoiriMusumePoolEntry([
  board,
  optimalMoveCount,
]: HakoiriMusumeProblemPoolEntry): HakoiriMusumeDecodedPoolEntry {
  return {
    identity: {
      generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
      seed: board,
      conditions: {},
    },
    optimalMoveCount,
  };
}

/** 問題集の1項目から問題を復元する。 */
export function restoreHakoiriMusumePoolEntry(
  entry: HakoiriMusumeProblemPoolEntry,
): HakoiriMusumePooledProblem {
  const { identity, optimalMoveCount } = decodeHakoiriMusumePoolEntry(entry);
  return { ...restoreHakoiriMusumeProblem(identity), optimalMoveCount };
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

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHakoiriMusumePoolEntryByProblemId(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumeProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}
