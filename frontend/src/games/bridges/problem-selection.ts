import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import {
  type BridgesRecordedProblemIdentity,
  isBridgesProblemIdentity,
} from "@/games/bridges/problem/problem";
import {
  type BridgesPooledProblem,
  findBridgesPoolEntry,
  findBridgesPoolEntryByProblemId,
  listBridgesPoolEntries,
  toBridgesPooledProblem,
} from "@/games/bridges/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 難易度の問題集から seed で1問を選ぶ。
 * 問題集は生成時に一意解と難易度を確かめ済みなので、プレイ時には生成・解探索・難易度分析を走らせない。
 */
export function selectBridgesProblemForDifficulty(
  difficulty: BridgesDifficulty,
  seed: ProblemSeed,
): BridgesPooledProblem {
  const entry = selectProblemPoolEntry(
    listBridgesPoolEntries(difficulty),
    seed,
    `level ${difficulty} Bridges`,
  );
  return toBridgesPooledProblem(entry);
}

/**
 * 記録に残した identity から同じ問題を復元する。
 * 問題集に無い identity（生成器の版が今と違う記録など）は復元できないので `null` を返す。
 */
export function restoreBridgesProblem(
  identity: BridgesRecordedProblemIdentity,
): BridgesPooledProblem | null {
  const entry = isBridgesProblemIdentity(identity)
    ? findBridgesPoolEntry(identity)
    : null;
  return entry ? toBridgesPooledProblem(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引く。引けない ID には `null` を返す。 */
export function selectBridgesProblemById(
  difficulty: BridgesDifficulty,
  problemId: string,
): BridgesPooledProblem | null {
  const entry = findBridgesPoolEntryByProblemId(difficulty, problemId);
  return entry ? toBridgesPooledProblem(entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectBridgesProblemById(
  difficulty: BridgesDifficulty,
  problemId: string,
): boolean {
  return findBridgesPoolEntryByProblemId(difficulty, problemId) !== null;
}
