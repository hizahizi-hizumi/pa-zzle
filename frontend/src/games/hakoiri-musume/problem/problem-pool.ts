import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import {
  createHakoiriMusumeProblemIdentity,
  type HAKOIRI_MUSUME_GENERATOR_VERSION,
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
 * - `preparationLength`: 準備の長さ（難易度の分析と同じ量）。速さの基準時間に使う。
 */
export type HakoiriMusumeProblemPoolEntry = readonly [
  board: string,
  optimalMoveCount: number,
  preparationLength: number,
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

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHakoiriMusumePoolEntryByProblemId(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumeProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}
